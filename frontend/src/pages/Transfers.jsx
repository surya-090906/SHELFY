import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { Plus, X, ChevronLeft, ChevronRight, RefreshCw, ArrowLeftRight } from 'lucide-react';

const STATUS_STYLES = {
  draft: 'text-slate-400 bg-slate-800 border-slate-700',
  waiting: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
  ready: 'text-brand-400 bg-brand-950/40 border-brand-800/40',
  done: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
  canceled: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
};

export default function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [validating, setValidating] = useState(null);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/transfers', { params });
      setTransfers(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterStatus]);

  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);
  useEffect(() => {
    api.get('/products', { params: { limit: 100 } }).then(r => setProducts(r.data.data)).catch(() => {});
    api.get('/locations').then(r => setLocations(r.data.data)).catch(() => {});
  }, []);

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: 1 }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true); setFormError(null);
    try {
      await api.post('/transfers', { from_location_id: fromLocation, to_location_id: toLocation, items });
      setShowForm(false); setFromLocation(''); setToLocation(''); setItems([{ product_id: '', quantity: 1 }]);
      fetchTransfers();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed to create transfer'); }
    finally { setFormLoading(false); }
  };

  const handleValidate = async (id) => {
    if (!window.confirm('Execute this transfer? Paired ledger entries will be written atomically.')) return;
    setValidating(id);
    try {
      await api.post(`/transfers/${id}/validate`);
      fetchTransfers();
    } catch (err) {
      const msg = err.response?.data;
      if (msg?.shortages) {
        alert('Insufficient stock at source:\n' + msg.shortages.map(s => `• ${s.product} @ ${s.location}: need ${s.requested}, have ${s.available}`).join('\n'));
      } else {
        alert(msg?.message || 'Validation failed');
      }
    } finally { setValidating(null); }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Internal Transfers</h1>
          <p className="text-xs text-slate-400 mt-1">Paired ledger writes: -qty source, +qty destination (atomic)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/20 transition">
          <Plus className="w-4 h-4" /><span>New Transfer</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'draft', 'waiting', 'ready', 'done', 'canceled'].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${filterStatus === s ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button onClick={fetchTransfers} className="ml-auto p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Transfer #</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">From</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">To</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Items</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading transfers...</td></tr>
              ) : transfers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No transfers found.</td></tr>
              ) : transfers.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4 font-mono text-emerald-400">TRF-{String(t.id).padStart(4, '0')}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-200">{t.fromLocation?.name}</p>
                    <p className="text-[11px] text-slate-500">{t.fromLocation?.warehouse?.name}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-200">{t.toLocation?.name}</p>
                    <p className="text-[11px] text-slate-500">{t.toLocation?.warehouse?.name}</p>
                  </td>
                  <td className="px-4 py-4 text-center text-slate-300">{t.items?.length || 0}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border capitalize ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      {t.status !== 'done' && t.status !== 'canceled' && (
                        <button onClick={() => handleValidate(t.id)} disabled={validating === t.id} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 transition border border-emerald-800/40 disabled:opacity-50">
                          {validating === t.id ? 'Executing...' : '✓ Execute'}
                        </button>
                      )}
                      <button onClick={() => setSelectedTransfer(t)} className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 text-[11px] font-semibold hover:bg-slate-600 transition">Detail</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-900/50">
            <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40 transition"><ChevronLeft className="w-4 h-4 text-slate-300" /></button>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40 transition"><ChevronRight className="w-4 h-4 text-slate-300" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">New Internal Transfer</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {formError && <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">From Location *</label>
                  <select required value={fromLocation} onChange={e => setFromLocation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition">
                    <option value="">Select source</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse?.name} › {l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">To Location *</label>
                  <select required value={toLocation} onChange={e => setToLocation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition">
                    <option value="">Select destination</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse?.name} › {l.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-300">Products to Transfer *</label>
                  <button type="button" onClick={addItem} className="flex items-center space-x-1 text-xs text-brand-400 hover:text-brand-300 transition"><Plus className="w-3.5 h-3.5" /><span>Add Line</span></button>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <select required value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)} className="col-span-9 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition">
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                      <input type="number" min={0.01} step="any" required value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" className="col-span-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500 transition" />
                      <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="col-span-1 flex items-center justify-center p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg disabled:opacity-30 transition"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition disabled:opacity-50">{formLoading ? 'Creating...' : 'Create Transfer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Transfer TRF-{String(selectedTransfer.id).padStart(4, '0')}</h3>
              <button onClick={() => setSelectedTransfer(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                <div className="flex-1"><p className="text-slate-500 mb-0.5">From</p><p className="font-semibold text-slate-200">{selectedTransfer.fromLocation?.name}</p><p className="text-[11px] text-slate-500">{selectedTransfer.fromLocation?.warehouse?.name}</p></div>
                <ArrowLeftRight className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="flex-1 text-right"><p className="text-slate-500 mb-0.5">To</p><p className="font-semibold text-slate-200">{selectedTransfer.toLocation?.name}</p><p className="text-[11px] text-slate-500">{selectedTransfer.toLocation?.warehouse?.name}</p></div>
              </div>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                {selectedTransfer.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 text-xs">
                    <p className="font-semibold text-slate-200">{item.product?.name}</p>
                    <span className="font-bold text-white">{item.quantity} <span className="text-slate-500 font-normal">{item.product?.unit_of_measure}</span></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end"><button onClick={() => setSelectedTransfer(null)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
