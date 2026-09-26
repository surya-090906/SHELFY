'use client';

import React, { useState } from 'react';
import { DeliveryOrder } from '@/lib/types';
import {
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { validateDelivery } from '@/actions/inventoryActions';

interface DeliveriesManagerProps {
  initialDeliveries: DeliveryOrder[];
}

export default function DeliveriesManager({ initialDeliveries }: DeliveriesManagerProps) {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>(initialDeliveries);
  const [filter, setFilter] = useState<'all' | 'draft' | 'waiting' | 'ready' | 'done'>('all');
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const filtered = deliveries.filter((d) => (filter === 'all' ? true : d.status === filter));

  const handleValidate = async (id: string) => {
    setValidatingId(id);
    setFeedback(null);

    try {
      await validateDelivery(id);
      setDeliveries((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'done' as const } : d))
      );
      setFeedback({
        type: 'success',
        message: 'Delivery successfully validated and dispatched! Stock deducted from ledger.',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Validation failed.',
      });
    } finally {
      setValidatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Outbound Deliveries</h1>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch orders to customers. Insufficient stock items are flagged in red.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
              : 'bg-red-950/60 border-red-800/80 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {(['all', 'draft', 'waiting', 'ready', 'done'] as const).map((tab) => (
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

      {/* Deliveries Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Line Items &amp; Stock Availability</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No delivery orders found for &ldquo;{filter}&rdquo; status.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const hasShortage = (item.lines || []).some((l) => l.is_short);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        hasShortage ? 'bg-red-950/20' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-bold text-cyan-400">{item.reference}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-200 font-medium">
                        {item.customer_name || 'Generic Customer'}
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
                        ) : item.status === 'waiting' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60 text-[10px] font-semibold uppercase tracking-wider">
                            <Clock className="w-3 h-3" />
                            Waiting (Shortage)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold uppercase tracking-wider">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          {(item.lines || []).map((line) => (
                            <div
                              key={line.id}
                              className={`flex items-center gap-2 p-1.5 rounded-lg text-[11px] font-mono ${
                                line.is_short
                                  ? 'bg-red-950/60 border border-red-800/80 text-red-300 font-semibold'
                                  : 'text-slate-300'
                              }`}
                            >
                              {line.is_short && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                              <span>
                                Ordered: {line.quantity_ordered} Units
                              </span>
                              {line.available_stock !== undefined && (
                                <span className={line.is_short ? 'text-red-400' : 'text-slate-500'}>
                                  (Available: {line.available_stock})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {item.status !== 'done' && (
                          <button
                            type="button"
                            disabled={validatingId === item.id || item.status === 'waiting'}
                            onClick={() => handleValidate(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {validatingId === item.id ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Deducting…</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Dispatch Order</span>
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
