import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { RefreshCw, ChevronLeft, ChevronRight, SlidersHorizontal, AlertTriangle, CheckCircle, MinusCircle } from 'lucide-react';

export default function Adjustments() {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [countedQty, setCountedQty] = useState('');
  const [reason, setReason] = useState('');
  const [previewDelta, setPreviewDelta] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/adjustments', { params: { page, limit: 15 } });
      setAdjustments(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchAdjustments(); }, [fetchAdjustments]);
  useEffect(() => {
    api.get('/products', { params: { limit: 100 } }).then(r => setProducts(r.data.data)).catch(() => {});
    api.get('/locations').then(r => setLocations(r.data.data)).catch(() => {});
  }, []);

  // Live preview: fetch current stock and compute delta when product+location+qty are all set
  useEffect(() => {
    if (!selectedProduct || !selectedLocation || countedQty === '') { setPreviewDelta(null); return; }
    const qty = parseFloat(countedQty);
    if (isNaN(qty) || qty < 0) { setPreviewDelta(null); return; }

    const controller = new AbortController();
    setPreviewLoading(true);
    api.get(`/products/${selectedProduct}/stock`, { signal: controller.signal })
      .then(res => {
        const locBreakdown = res.data.data?.locations || [];
        const locData = locBreakdown.find(l => l.location_id === parseInt(selectedLocation));
        const systemQty = locData ? locData.current_stock : 0;
        setPreviewDelta({ systemQty, counted: qty, delta: qty - systemQty });
        setPreviewLoading(false);
      })
      .catch(e => { if (!e?.name?.includes('Cancel')) setPreviewLoading(false); });

    return () => controller.abort();
  }, [selectedProduct, selectedLocation, countedQty]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true); setFormError(null);
    try {
      await api.post('/adjustments', {
        product_id: selectedProduct,
        location_id: selectedLocation,
        counted_quantity: parseFloat(countedQty),
        reason,
      });
      setShowForm(false);
      setSelectedProduct(''); setSelectedLocation(''); setCountedQty(''); setReason('');
      setPreviewDelta(null);
      fetchAdjustments();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed to submit adjustment'); }
    finally { setFormLoading(false); }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Stock Adjustments</h1>
          <p className="text-xs text-slate-400 mt-1">Physical cycle count reconciliation — delta written to immutable ledger</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition">
          <SlidersHorizontal className="w-4 h-4" /><span>New Adjustment</span>
        </button>
      </div>

      {/* Adjustment Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Physical Inventory Adjustment</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">{formError}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Product *</label>
                  <select required value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition">
                    <option value="">Select Product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Location *</label>
                  <select required value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition">
                    <option value="">Select Location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse?.name} › {l.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Physically Counted Qty *</label>
                <input type="number" required min={0} step="any" value={countedQty} onChange={e => setCountedQty(e.target.value)} placeholder="Enter actual physical count" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition" />
              </div>

              {/* Live Delta Preview */}
              {previewLoading && <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-400 text-center animate-pulse">Computing ledger delta...</div>}
              {previewDelta && !previewLoading && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 ${previewDelta.delta === 0 ? 'bg-slate-900 border-slate-700' : previewDelta.delta > 0 ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-rose-950/20 border-rose-800/40'}`}>
                  <div className="flex justify-between">
                    <span className="text-slate-400">System Ledger Stock:</span>
                    <span className="font-mono font-bold text-slate-200">{previewDelta.systemQty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Physically Counted:</span>
                    <span className="font-mono font-bold text-slate-200">{previewDelta.counted}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 mt-1">
                    <span className="font-semibold text-slate-300">Ledger Delta to Write:</span>
                    <span className={`font-mono font-black text-base ${previewDelta.delta > 0 ? 'text-emerald-400' : previewDelta.delta < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                      {previewDelta.delta > 0 ? '+' : ''}{previewDelta.delta}
                    </span>
                  </div>
                  {previewDelta.delta === 0 && <p className="text-slate-500 text-center text-[11px]">No change — physical count matches the ledger exactly.</p>}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Reason / Notes</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Physical count audit, damaged goods, data entry correction..." rows={2} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition resize-none" />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50">{formLoading ? 'Recording...' : 'Record Adjustment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjustments Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Location</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">System Qty</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Counted Qty</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Delta</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Reason</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">By</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">Loading adjustments...</td></tr>
              ) : adjustments.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">No adjustments recorded yet.</td></tr>
              ) : adjustments.map(adj => (
                <tr key={adj.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-200">{adj.product?.name}</p>
                    <span className="font-mono text-[11px] text-slate-500">{adj.product?.sku}</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-slate-300">{adj.location?.name}</p>
                    <p className="text-[11px] text-slate-500">{adj.location?.warehouse?.name}</p>
                  </td>
                  <td className="px-4 py-4 text-center font-mono text-slate-300">{adj.system_quantity}</td>
                  <td className="px-4 py-4 text-center font-mono text-white font-bold">{adj.counted_quantity}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-mono font-black text-sm ${adj.delta > 0 ? 'text-emerald-400' : adj.delta < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {adj.delta > 0 ? '+' : ''}{adj.delta}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-400 max-w-[150px] truncate">{adj.reason || '—'}</td>
                  <td className="px-4 py-4 text-slate-400">{adj.creator?.name || '—'}</td>
                  <td className="px-4 py-4 text-slate-400">{new Date(adj.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-900/50">
            <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40"><ChevronLeft className="w-4 h-4 text-slate-300" /></button>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40"><ChevronRight className="w-4 h-4 text-slate-300" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
