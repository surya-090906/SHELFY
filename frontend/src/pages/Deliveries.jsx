import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { Plus, X, ChevronLeft, ChevronRight, RefreshCw, Truck } from 'lucide-react';

const STATUS_STYLES = {
  draft: 'text-slate-400 bg-slate-800 border-slate-700',
  waiting: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
  ready: 'text-brand-400 bg-brand-950/40 border-brand-800/40',
  done: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
  canceled: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
};

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customerRef, setCustomerRef] = useState('');
  const [items, setItems] = useState([{ product_id: '', location_id: '', quantity: 1 }]);
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [validating, setValidating] = useState(null);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/deliveries', { params });
      setDeliveries(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterStatus]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);
  useEffect(() => {
    api.get('/products', { params: { limit: 100 } }).then(r => setProducts(r.data.data)).catch(() => {});
    api.get('/locations').then(r => setLocations(r.data.data)).catch(() => {});
  }, []);

  const addItem = () => setItems(prev => [...prev, { product_id: '', location_id: '', quantity: 1 }]);
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true); setFormError(null);
    try {
      await api.post('/deliveries', { customer_ref: customerRef, items });
      setShowForm(false); setCustomerRef(''); setItems([{ product_id: '', location_id: '', quantity: 1 }]);
      fetchDeliveries();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed to create delivery'); }
    finally { setFormLoading(false); }
  };

  const handleValidate = async (id) => {
    if (!window.confirm('Validate this delivery? Stock will be deducted from ledger. This cannot be undone.')) return;
    setValidating(id);
    try {
      await api.post(`/deliveries/${id}/validate`);
      fetchDeliveries();
    } catch (err) {
      const msg = err.response?.data;
      if (msg?.insufficientItems) {
        alert('Insufficient stock:\n' + msg.insufficientItems.map(i => `• ${i.product} @ ${i.location}: need ${i.requested}, have ${i.available}`).join('\n'));
      } else {
        alert(msg?.message || 'Validation failed');
      }
    } finally { setValidating(null); }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Delivery Orders</h1>
          <p className="text-xs text-slate-400 mt-1">Validation checks live ledger stock before deducting</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/20 transition">
          <Plus className="w-4 h-4" /><span>New Delivery Order</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'draft', 'waiting', 'ready', 'done', 'canceled'].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${filterStatus === s ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button onClick={fetchDeliveries} className="ml-auto p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Order #</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Customer Ref</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Items</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Created By</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading deliveries...</td></tr>
              ) : deliveries.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No delivery orders found.</td></tr>
              ) : deliveries.map(d => (
                <tr key={d.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-4 font-mono text-indigo-400">DO-{String(d.id).padStart(4, '0')}</td>
                  <td className="px-4 py-4 font-semibold text-slate-200 max-w-[200px] truncate">{d.customer_ref}</td>
                  <td className="px-4 py-4 text-center text-slate-300">{d.items?.length || 0}</td>
                  <td className="px-4 py-4 text-slate-400">{d.creator?.name || '—'}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border capitalize ${STATUS_STYLES[d.status]}`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-4 text-slate-400">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      {d.status !== 'done' && d.status !== 'canceled' && (
                        <button onClick={() => handleValidate(d.id)} disabled={validating === d.id} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 transition border border-emerald-800/40 disabled:opacity-50">
                          {validating === d.id ? 'Validating...' : '✓ Dispatch'}
                        </button>
                      )}
                      <button onClick={() => setSelectedDelivery(d)} className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 text-[11px] font-semibold hover:bg-slate-600 transition">Detail</button>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Create Delivery Order</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {formError && <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Customer Reference *</label>
                <input required value={customerRef} onChange={e => setCustomerRef(e.target.value)} placeholder="e.g. CUST-ORD-9999 (AeroTech Labs)" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-300">Pick Items (from location) *</label>
                  <button type="button" onClick={addItem} className="flex items-center space-x-1 text-xs text-brand-400 hover:text-brand-300 transition"><Plus className="w-3.5 h-3.5" /><span>Add Line</span></button>
                </div>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <select required value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)} className="col-span-5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition">
                        <option value="">Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                      <select required value={item.location_id} onChange={e => updateItem(i, 'location_id', e.target.value)} className="col-span-4 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition">
                        <option value="">Pick From</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.warehouse?.name} › {l.name}</option>)}
                      </select>
                      <input type="number" min={0.01} step="any" required value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" className="col-span-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-brand-500 transition" />
                      <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="col-span-1 flex items-center justify-center p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg disabled:opacity-30 transition"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition disabled:opacity-50">{formLoading ? 'Creating...' : 'Create Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Delivery Detail — DO-{String(selectedDelivery.id).padStart(4, '0')}</h3>
              <button onClick={() => setSelectedDelivery(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800"><span className="text-slate-500">Customer</span><p className="font-semibold text-white mt-1 text-[11px]">{selectedDelivery.customer_ref}</p></div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800"><span className="text-slate-500">Status</span><p className={`font-semibold mt-1 capitalize ${selectedDelivery.status === 'done' ? 'text-emerald-400' : 'text-amber-400'}`}>{selectedDelivery.status}</p></div>
              </div>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                {selectedDelivery.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 text-xs">
                    <div><p className="font-semibold text-slate-200">{item.product?.name}</p><p className="text-slate-500 text-[11px]">{item.location?.warehouse?.name} › {item.location?.name}</p></div>
                    <div className="text-right"><span className="font-bold text-white">{item.quantity}</span><span className="text-slate-500 ml-1">{item.product?.unit_of_measure}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end"><button onClick={() => setSelectedDelivery(null)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
