'use client';

import React, { useState } from 'react';
import { Product } from '@/lib/types';
import {
  Search,
  Plus,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  PackagePlus,
} from 'lucide-react';
import { createProduct } from '@/actions/inventoryActions';

interface ProductsTableProps {
  initialProducts: Product[];
  isManager: boolean;
}

export default function ProductsTable({ initialProducts, isManager }: ProductsTableProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    description: '',
    uom: 'Units',
    per_unit_cost: 0,
    reorder_threshold: 10,
    initial_stock: 0,
  });

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());

    const stock = p.current_stock ?? 0;
    if (filterStatus === 'low') return matchesSearch && stock > 0 && stock <= p.reorder_threshold;
    if (filterStatus === 'out') return matchesSearch && stock <= 0;
    return matchesSearch;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    try {
      const res = await createProduct({
        ...form,
        per_unit_cost: Number(form.per_unit_cost),
        reorder_threshold: Number(form.reorder_threshold),
        initial_stock: Number(form.initial_stock),
      });

      if (res.success && res.product) {
        setProducts([
          { ...res.product, current_stock: Number(form.initial_stock) },
          ...products,
        ]);
        setModalOpen(false);
        setForm({
          name: '',
          sku: '',
          barcode: '',
          description: '',
          uom: 'Units',
          per_unit_cost: 0,
          reorder_threshold: 10,
          initial_stock: 0,
        });
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Product Catalog</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your inventory items, stock levels, and replenishment thresholds.
          </p>
        </div>
        {isManager && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setFilterStatus('low')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'low'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setFilterStatus('out')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === 'out'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Product Name &amp; SKU</th>
                <th className="px-5 py-3.5">Unit of Measure</th>
                <th className="px-5 py-3.5">Cost / Unit</th>
                <th className="px-5 py-3.5">Reorder Threshold</th>
                <th className="px-5 py-3.5">Current Stock</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No products found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const stock = item.current_stock ?? 0;
                  const isOutOfStock = stock <= 0;
                  const isLowStock = !isOutOfStock && stock <= item.reorder_threshold;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="text-[11px] font-mono text-cyan-400 mt-0.5">{item.sku}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 font-medium">{item.uom}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-200">
                        ${Number(item.per_unit_cost).toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">
                        {item.reorder_threshold} {item.uom}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isOutOfStock
                              ? 'text-red-400'
                              : isLowStock
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {stock}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/60 text-[10px] font-semibold uppercase tracking-wider">
                            <XCircle className="w-3 h-3" />
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60 text-[10px] font-semibold uppercase tracking-wider">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[10px] font-semibold uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" />
                            In Stock
                          </span>
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

      {/* Add Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create New Product</h2>
                <p className="text-xs text-slate-400">Scoped automatically to your organization.</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Heavy Duty Steel Pallet"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                    placeholder="SKU-001"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Unit of Measure (UOM)</label>
                  <select
                    value={form.uom}
                    onChange={(e) => setForm({ ...form, uom: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Units">Units</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Kilograms">Kilograms (kg)</option>
                    <option value="Meters">Meters (m)</option>
                    <option value="Rolls">Rolls</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Cost / Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.per_unit_cost}
                    onChange={(e) => setForm({ ...form, per_unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Reorder Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={form.reorder_threshold}
                    onChange={(e) => setForm({ ...form, reorder_threshold: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Initial Stock Count</label>
                  <input
                    type="number"
                    min="0"
                    value={form.initial_stock}
                    onChange={(e) => setForm({ ...form, initial_stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
