import React from 'react';
import { supabaseServer } from '@/lib/supabaseServer';
import { StockLedgerEntry } from '@/lib/types';
import { History, TrendingUp, TrendingDown, RefreshCw, Filter } from 'lucide-react';

async function getStockLedger(): Promise<StockLedgerEntry[]> {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase
      .from('stock_ledger')
      .select('*, product:products(name, sku), location:locations(name, code)')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      // Demo entries fallback
      return [
        {
          id: '1',
          company_id: 'org_demo',
          product_id: 'prod_1',
          location_id: 'loc_1',
          quantity_change: 50,
          movement_type: 'receipt',
          reference: 'WH/IN/0001',
          created_by: 'user_clerk_1',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          product: {
            id: 'prod_1',
            company_id: 'org_demo',
            name: 'Heavy Duty Steel Pallet',
            sku: 'PALLET-HD-01',
            uom: 'Units',
            per_unit_cost: 145,
            reorder_threshold: 15,
            is_active: true,
            created_at: new Date().toISOString(),
          },
        },
        {
          id: '2',
          company_id: 'org_demo',
          product_id: 'prod_2',
          location_id: 'loc_1',
          quantity_change: -12,
          movement_type: 'delivery',
          reference: 'WH/OUT/0001',
          created_by: 'user_clerk_1',
          created_at: new Date(Date.now() - 7200000).toISOString(),
          product: {
            id: 'prod_2',
            company_id: 'org_demo',
            name: 'Pneumatic Control Valve 2"',
            sku: 'VALVE-PN-02',
            uom: 'Units',
            per_unit_cost: 320.5,
            reorder_threshold: 10,
            is_active: true,
            created_at: new Date().toISOString(),
          },
        },
      ];
    }
    return data;
  } catch {
    return [];
  }
}

export default async function MoveHistoryPage() {
  const ledger = await getStockLedger();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Move History</h1>
        <p className="text-xs text-slate-400 mt-1">
          Complete, immutable stock movement audit ledger. Inbound entries in green, outbound in red.
        </p>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Type &amp; Movement</th>
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Product &amp; SKU</th>
                <th className="px-5 py-3.5">Quantity Delta</th>
                <th className="px-5 py-3.5">Recorded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No movements recorded yet in the ledger.
                  </td>
                </tr>
              ) : (
                ledger.map((entry) => {
                  const isPositive = Number(entry.quantity_change) > 0;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg border text-xs ${
                              isPositive
                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                                : 'bg-red-950/60 text-red-400 border-red-800/60'
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-300">
                            {entry.movement_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-cyan-400">{entry.reference}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white">{entry.product?.name || 'Item'}</div>
                        <div className="text-[11px] font-mono text-slate-400">{entry.product?.sku}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isPositive ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isPositive ? `+${entry.quantity_change}` : entry.quantity_change}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px]">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
