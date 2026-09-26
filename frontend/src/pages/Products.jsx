import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import StockBreakdownModal from '../components/StockBreakdownModal';
import {
  Search, Plus, Edit2, Trash2, BarChart2, Package, AlertTriangle,
  CheckCircle, XCircle, X, ChevronLeft, ChevronRight, RefreshCw, Tag
} from 'lucide-react';

const STATUS_COLORS = {
  in_stock: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60',
  low_stock: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
  out_of_stock: 'text-rose-400 bg-rose-950/40 border-rose-800/60',
};

export default function Products() {
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [stockModalProductId, setStockModalProductId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', sku: '', category_id: '', unit_of_measure: 'units', reorder_threshold: 10 });
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (selectedCategory) params.category = selectedCategory;
      const res = await api.get('/products', { params });
      setProducts(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, selectedCategory]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data.data)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditProduct(null);
    setFormData({ name: '', sku: '', category_id: '', unit_of_measure: 'units', reorder_threshold: 10 });
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setFormData({ name: p.name, sku: p.sku, category_id: p.category_id, unit_of_measure: p.unit_of_measure, reorder_threshold: p.reorder_threshold });
    setFormError(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true); setFormError(null);
    try {
      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, formData);
      } else {
        await api.post('/products', formData);
      }
      setShowForm(false);
      fetchProducts();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Operation failed');
    } finally { setFormLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product? This action cannot be undone if no ledger history exists.')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Cannot delete product');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Products & Stock</h1>
          <p className="text-xs text-slate-400 mt-1">Derived stock calculated from immutable ledger entries</p>
        </div>
        {isManager && (
          <button onClick={openCreate} className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/20 transition">
            <Plus className="w-4 h-4" /><span>Add Product</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or SKU..." className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition" />
        </div>
        <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setPage(1); }} className="px-4 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 focus:outline-none focus:border-brand-500 transition min-w-[160px]">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={fetchProducts} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Products Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">SKU</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Derived Stock</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Threshold</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No products found.</td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition group">
                  <td className="px-5 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0"><Package className="w-4 h-4" /></div>
                      <div>
                        <p className="font-semibold text-slate-200 text-xs">{p.name}</p>
                        <p className="text-[11px] text-slate-500">{p.unit_of_measure}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><span className="font-mono text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded">{p.sku}</span></td>
                  <td className="px-4 py-4">
                    <span className="flex items-center space-x-1.5 text-slate-400"><Tag className="w-3 h-3" /><span>{p.category?.name || '—'}</span></span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-bold text-lg text-white">{p.current_stock ?? '—'}</span>
                    <span className="text-[11px] text-slate-500 ml-1">{p.unit_of_measure}</span>
                  </td>
                  <td className="px-4 py-4 text-center text-slate-400">{p.reorder_threshold}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border capitalize ${STATUS_COLORS[p.stock_status]}`}>
                      {p.stock_status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button onClick={() => setStockModalProductId(p.id)} className="p-1.5 rounded-lg text-brand-400 hover:bg-brand-500/10 transition" title="View stock breakdown"><BarChart2 className="w-4 h-4" /></button>
                      {isManager && (<>
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition" title="Edit product"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition" title="Delete product"><Trash2 className="w-4 h-4" /></button>
                      </>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-900/50">
            <span className="text-xs text-slate-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">{editProduct ? 'Edit Product' : 'New Product'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Product Name *</label>
                  <input required value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Microcontroller ESP32" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">SKU *</label>
                  <input required value={formData.sku} onChange={e => setFormData(d => ({ ...d, sku: e.target.value }))} placeholder="MCU-ESP32" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Unit of Measure</label>
                  <input value={formData.unit_of_measure} onChange={e => setFormData(d => ({ ...d, unit_of_measure: e.target.value }))} placeholder="units" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Category *</label>
                  <select required value={formData.category_id} onChange={e => setFormData(d => ({ ...d, category_id: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition">
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Reorder Threshold</label>
                  <input type="number" min={0} value={formData.reorder_threshold} onChange={e => setFormData(d => ({ ...d, reorder_threshold: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-brand-500 transition" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
                <button type="submit" disabled={formLoading} className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition disabled:opacity-50">
                  {formLoading ? 'Saving...' : editProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Breakdown Modal */}
      {stockModalProductId && <StockBreakdownModal productId={stockModalProductId} onClose={() => setStockModalProductId(null)} />}
    </div>
  );
}
