import React from 'react';
import { supabaseServer } from '@/lib/supabaseServer';
import { Receipt } from '@/lib/types';
import ReceiptsManager from '@/components/tenant/ReceiptsManager';

async function getReceipts(): Promise<Receipt[]> {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('receipts')
      .select('*, destination_location:locations(name), lines:receipt_lines(*, product:products(name, sku))')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      // Demo receipts fallback
      return [
        {
          id: 'rec_1',
          company_id: 'org_demo',
          reference: 'WH/IN/0001',
          supplier_name: 'Industrial Metals Supply Co.',
          destination_location_id: 'loc_1',
          status: 'ready',
          notes: 'Standard batch intake for heavy pallets',
          created_by: 'user_1',
          created_at: new Date().toISOString(),
          lines: [
            {
              id: 'line_1',
              receipt_id: 'rec_1',
              company_id: 'org_demo',
              product_id: 'prod_1',
              quantity_expected: 50,
              quantity_received: 50,
              unit_cost: 140.0,
            },
          ],
        },
        {
          id: 'rec_2',
          company_id: 'org_demo',
          reference: 'WH/IN/0002',
          supplier_name: 'Pneumatics Express Ltd',
          destination_location_id: 'loc_1',
          status: 'draft',
          notes: 'Emergency replacement valves',
          created_by: 'user_1',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          lines: [
            {
              id: 'line_2',
              receipt_id: 'rec_2',
              company_id: 'org_demo',
              product_id: 'prod_2',
              quantity_expected: 20,
              quantity_received: 0,
              unit_cost: 310.0,
            },
          ],
        },
      ];
    }

    return data;
  } catch {
    return [];
  }
}

export default async function ReceiptsPage() {
  const receipts = await getReceipts();
  return (
    <div className="space-y-6">
      <ReceiptsManager initialReceipts={receipts} />
    </div>
  );
}
