import React from 'react';
import { supabaseServer } from '@/lib/supabaseServer';
import { DeliveryOrder } from '@/lib/types';
import DeliveriesManager from '@/components/tenant/DeliveriesManager';

async function getDeliveries(): Promise<DeliveryOrder[]> {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('delivery_orders')
      .select('*, source_location:locations(name), lines:delivery_lines(*, product:products(name, sku))')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      // Demo deliveries fallback
      return [
        {
          id: 'del_1',
          company_id: 'org_demo',
          reference: 'WH/OUT/0001',
          customer_name: 'Metro Construction Supply',
          source_location_id: 'loc_1',
          status: 'ready',
          notes: 'Priority dispatch for downtown site',
          created_by: 'user_1',
          created_at: new Date().toISOString(),
          lines: [
            {
              id: 'line_1',
              delivery_order_id: 'del_1',
              company_id: 'org_demo',
              product_id: 'prod_1',
              quantity_ordered: 10,
              quantity_delivered: 0,
              available_stock: 42,
              is_short: false,
            },
          ],
        },
        {
          id: 'del_2',
          company_id: 'org_demo',
          reference: 'WH/OUT/0002',
          customer_name: 'Pacific Freightline Hub',
          source_location_id: 'loc_1',
          status: 'waiting',
          notes: 'Awaiting restocking of pneumatic valves',
          created_by: 'user_1',
          created_at: new Date(Date.now() - 43200000).toISOString(),
          lines: [
            {
              id: 'line_2',
              delivery_order_id: 'del_2',
              company_id: 'org_demo',
              product_id: 'prod_2',
              quantity_ordered: 25,
              quantity_delivered: 0,
              available_stock: 4, // 4 < 25 -> SHORT! Red alert!
              is_short: true,
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

export default async function DeliveriesPage() {
  const deliveries = await getDeliveries();
  return (
    <div className="space-y-6">
      <DeliveriesManager initialDeliveries={deliveries} />
    </div>
  );
}
