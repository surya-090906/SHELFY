'use client';

import React, { useState } from 'react';
import { Receipt } from '@/lib/types';
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Check,
  Search,
  Plus,
  RefreshCw,
  Building2,
  Package,
} from 'lucide-react';
import { validateReceipt } from '@/actions/inventoryActions';

interface ReceiptsManagerProps {
  initialReceipts: Receipt[];
}

export default function ReceiptsManager({ initialReceipts }: ReceiptsManagerProps) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [filter, setFilter] = useState<'all' | 'draft' | 'ready' | 'done'>('all');
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = receipts.filter((r) => (filter === 'all' ? true : r.status === filter));

  const handleValidate = async (id: string) => {
    setValidatingId(id);
    setMessage(null);

    try {
      await validateReceipt(id);
      setReceipts((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'done' as const } : r))
      );
      setMessage('Receipt successfully validated! Quantities posted to stock ledger.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Validation failed.');
    } finally {
      setValidatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Inbound Receipts</h1>
          <p className="text-xs text-slate-400 mt-1">
            Receive incoming vendor shipments and update stock ledger inventory.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {(['all', 'draft', 'ready', 'done'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              filter === tab
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Receipts Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Supplier</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Expected Qty</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No receipts found for &ldquo;{filter}&rdquo; status.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const totalExpected = (item.lines || []).reduce(
                    (sum, l) => sum + Number(l.quantity_expected),
                    0
                  );

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-cyan-400">{item.reference}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-200 font-medium">
                        {item.supplier_name || 'Generic Supplier'}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.status === 'done' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[10px] font-semibold uppercase tracking-wider">
                            <Check className="w-3 h-3" />
                            Done
                          </span>
                        ) : item.status === 'ready' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/60 text-[10px] font-semibold uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" />
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold uppercase tracking-wider">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-300 font-semibold">
                        {totalExpected} Units
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {item.status !== 'done' && (
                          <button
                            type="button"
                            disabled={validatingId === item.id}
                            onClick={() => handleValidate(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
                          >
                            {validatingId === item.id ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Posting…</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Validate &amp; Post</span>
                              </>
                            )}
                          </button>
                        )}
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
