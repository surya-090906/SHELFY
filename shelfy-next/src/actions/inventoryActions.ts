'use server';

import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { revalidatePath } from 'next/cache';

/**
 * Server Action: Creates a new tenant-scoped Product
 */
export async function createProduct(formData: {
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  uom: string;
  per_unit_cost: number;
  reorder_threshold: number;
  initial_stock?: number;
  location_id?: string;
}) {
  const { orgId, userId } = await auth();
  if (!orgId) throw new Error('Unauthorized: Active Organization required.');

  const supabase = await supabaseServer();

  // 1. Insert product
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .insert({
      company_id: orgId,
      name: formData.name.trim(),
      sku: formData.sku.trim().toUpperCase(),
      barcode: formData.barcode?.trim() || null,
      description: formData.description?.trim() || null,
      uom: formData.uom || 'Units',
      per_unit_cost: formData.per_unit_cost || 0,
      reorder_threshold: formData.reorder_threshold || 10,
    })
    .select()
    .single();

  if (prodErr) throw new Error(prodErr.message);

  // 2. If initial stock is specified, record it in the stock ledger
  if (formData.initial_stock && formData.initial_stock > 0 && formData.location_id) {
    await supabase.from('stock_ledger').insert({
      company_id: orgId,
      product_id: product.id,
      location_id: formData.location_id,
      quantity_change: formData.initial_stock,
      movement_type: 'adjustment',
      reference: 'INIT-STOCK',
      created_by: userId,
    });
  }

  // 3. Record Audit Log
  await supabase.from('audit_logs').insert({
    company_id: orgId,
    clerk_user_id: userId || 'unknown',
    action: 'product.created',
    entity_type: 'product',
    entity_id: product.id,
    after: product,
  });

  revalidatePath('/products');
  revalidatePath('/dashboard');
  return { success: true, product };
}

/**
 * Server Action: Validates an Inbound Receipt (Draft -> Ready -> Done)
 * Adds incoming quantities to stock ledger and checks if waiting deliveries can now be fulfilled.
 */
export async function validateReceipt(receiptId: string) {
  const { orgId, userId } = await auth();
  if (!orgId) throw new Error('Unauthorized: Active Organization required.');

  const supabase = await supabaseServer();

  // 1. Fetch receipt and lines
  const { data: receipt, error: rErr } = await supabase
    .from('receipts')
    .select('*, lines:receipt_lines(*)')
    .eq('id', receiptId)
    .single();

  if (rErr || !receipt) throw new Error('Receipt not found');
  if (receipt.status === 'done') throw new Error('Receipt is already validated and immutable.');

  // 2. Mark receipt as Done
  await supabase
    .from('receipts')
    .update({ status: 'done', validated_at: new Date().toISOString() })
    .eq('id', receiptId);

  // 3. Insert into immutable stock ledger
  if (receipt.lines && receipt.lines.length > 0) {
    const ledgerEntries = receipt.lines.map((line: any) => ({
      company_id: orgId,
      product_id: line.product_id,
      location_id: receipt.destination_location_id,
      quantity_change: line.quantity_expected,
      movement_type: 'receipt',
      reference: receipt.reference,
      created_by: userId,
    }));

    await supabase.from('stock_ledger').insert(ledgerEntries);
  }

  // 4. Audit Log
  await supabase.from('audit_logs').insert({
    company_id: orgId,
    clerk_user_id: userId || 'unknown',
    action: 'receipt.validated',
    entity_type: 'receipt',
    entity_id: receipt.id,
    after: { status: 'done', reference: receipt.reference },
  });

  // 5. Restocking Automation: Check any waiting delivery orders to see if they can now be marked Ready
  const { data: waitingDeliveries } = await supabase
    .from('delivery_orders')
    .select('id, lines:delivery_lines(product_id, quantity_ordered)')
    .eq('status', 'waiting');

  if (waitingDeliveries) {
    for (const d of waitingDeliveries) {
      // Check stock sufficiency for this delivery
      let canFulfill = true;
      for (const line of d.lines || []) {
        const { data: stockData } = await supabase
          .from('stock_ledger')
          .select('quantity_change')
          .eq('product_id', line.product_id);

        const currentTotal = (stockData || []).reduce((sum, s) => sum + Number(s.quantity_change), 0);
        if (currentTotal < Number(line.quantity_ordered)) {
          canFulfill = false;
          break;
        }
      }

      if (canFulfill) {
        await supabase.from('delivery_orders').update({ status: 'ready' }).eq('id', d.id);
      }
    }
  }

  revalidatePath('/receipts');
  revalidatePath('/deliveries');
  revalidatePath('/dashboard');
  revalidatePath('/move-history');
  return { success: true };
}

/**
 * Server Action: Validates an Outbound Delivery Order (Draft -> Waiting/Ready -> Done)
 * Checks for sufficient stock, flags short items, and deducts from ledger.
 */
export async function validateDelivery(deliveryId: string) {
  const { orgId, userId } = await auth();
  if (!orgId) throw new Error('Unauthorized: Active Organization required.');

  const supabase = await supabaseServer();

  // 1. Fetch delivery and lines
  const { data: delivery, error: dErr } = await supabase
    .from('delivery_orders')
    .select('*, lines:delivery_lines(*)')
    .eq('id', deliveryId)
    .single();

  if (dErr || !delivery) throw new Error('Delivery Order not found');
  if (delivery.status === 'done') throw new Error('Delivery order is already validated.');

  // 2. Verify stock sufficiency for every line
  for (const line of delivery.lines || []) {
    const { data: stockData } = await supabase
      .from('stock_ledger')
      .select('quantity_change')
      .eq('product_id', line.product_id)
      .eq('location_id', delivery.source_location_id);

    const availableStock = (stockData || []).reduce((sum, s) => sum + Number(s.quantity_change), 0);
    if (availableStock < Number(line.quantity_ordered)) {
      // Mark as Waiting if stock is insufficient
      await supabase.from('delivery_orders').update({ status: 'waiting' }).eq('id', deliveryId);
      throw new Error(`Insufficient stock for product. Available: ${availableStock}, Ordered: ${line.quantity_ordered}. Order placed in Waiting status.`);
    }
  }

  // 3. Mark delivery as Done
  await supabase
    .from('delivery_orders')
    .update({ status: 'done', validated_at: new Date().toISOString() })
    .eq('id', deliveryId);

  // 4. Deduct quantities in stock ledger (negative movement)
  const ledgerEntries = (delivery.lines || []).map((line: any) => ({
    company_id: orgId,
    product_id: line.product_id,
    location_id: delivery.source_location_id,
    quantity_change: -Math.abs(Number(line.quantity_ordered)),
    movement_type: 'delivery',
    reference: delivery.reference,
    created_by: userId,
  }));

  await supabase.from('stock_ledger').insert(ledgerEntries);

  // 5. Audit Log
  await supabase.from('audit_logs').insert({
    company_id: orgId,
    clerk_user_id: userId || 'unknown',
    action: 'delivery.validated',
    entity_type: 'delivery_order',
    entity_id: delivery.id,
    after: { status: 'done', reference: delivery.reference },
  });

  revalidatePath('/deliveries');
  revalidatePath('/dashboard');
  revalidatePath('/move-history');
  return { success: true };
}
