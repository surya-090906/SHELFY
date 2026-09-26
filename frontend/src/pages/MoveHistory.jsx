import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { RefreshCw, ChevronLeft, ChevronRight, Filter, History } from 'lucide-react';

const MOVEMENT_COLORS = {
  receipt: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
  delivery: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
  transfer: 'text-brand-400 bg-brand-950/40 border-brand-800/40',
  adjustment: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
};

export default function MoveHistory() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [filterType, setFilterType] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filterType) params.movementType = filterType;
      if (filterWarehouse) params.warehouseId = filterWarehouse;
      if (filterCategory) params.categoryId = filterCategory;
      if (filterStartDate) params.startDate = filterStartDate;
      if (filterEndDate) params.endDate = filterEndDate;
      const res = await api.get('/dashboard/move-history', { params });
      setEntries(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterType, filterWarehouse, filterCategory, filterStartDate, filterEndDate]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => {
    api.get('/warehouses').then(r => setWarehouses(r.data.data)).catch(() => {});
    api.get('/categories').then(r => setCategories(r.data.data)).catch(() => {});
  }, []);

  const resetFilters = () => {
    setFilterType(''); setFilterWarehouse(''); setFilterCategory('');
    setFilterStartDate(''); setFilterEndDate(''); setPage(1);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-3">
            <History className="w-7 h-7 text-brand-400" />
            <span>Move History — Stock Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Complete immutable audit trail. Every row is permanent and derives current stock.</p>
        </div>
        <button onClick={() => fetchHistory()} className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition">
          <RefreshCw className="w-3.5 h-3.5" /><span>Refresh</span>
        </button>
      </div>

      {/* Filter Panel */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" /><span>Filter Ledger</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition">
            <option value="">All Types</option>
            <option value="receipt">Receipt (+)</option>
            <option value="delivery">Delivery (−)</option>
            <option value="transfer">Transfer (±)</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <select value={filterWarehouse} onChange={e => { setFilterWarehouse(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition">
            <option value="">All Warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition" />
          <input type="date" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setPage(1); }} className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-brand-500 transition" />
        </div>
        {(filterType || filterWarehouse || filterCategory || filterStartDate || filterEndDate) && (
          <button onClick={resetFilters} className="text-xs text-slate-500 hover:text-slate-300 underline transition">Reset all filters</button>
        )}
      </div>

      {/* Ledger Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Ledger #</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Location</th>
                <th className="text-center px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Δ Qty</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Reference</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">By</th>
                <th className="text-left px-4 py-3.5 font-semibold text-slate-400 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">Loading ledger entries...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-500">No ledger entries match your filters.</td></tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-800/20 transition">
                  <td className="px-5 py-3.5 font-mono text-slate-500">#{entry.id}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border capitalize ${MOVEMENT_COLORS[entry.movement_type]}`}>
                      {entry.movement_type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-200">{entry.product?.name}</p>
                    <span className="font-mono text-[10px] text-slate-500">{entry.product?.sku}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-slate-300">{entry.location?.name}</p>
                    <p className="text-[11px] text-slate-500">{entry.location?.warehouse?.name}</p>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`font-mono font-black text-sm ${entry.quantity_delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {entry.quantity_delta > 0 ? '+' : ''}{entry.quantity_delta}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">
                    {entry.reference_type ? (
                      <span className="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded">{entry.reference_type}#{entry.reference_id}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">{entry.creator?.name || '—'}</td>
                  <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-900/50">
            <span className="text-xs text-slate-500">Showing {entries.length} of {pagination.total} entries</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Page {pagination.page} / {pagination.totalPages}</span>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40"><ChevronLeft className="w-4 h-4 text-slate-300" /></button>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40"><ChevronRight className="w-4 h-4 text-slate-300" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
