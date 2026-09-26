import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { X, MapPin, Package, AlertCircle } from 'lucide-react';

export default function StockBreakdownModal({ productId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    const fetchStock = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/products/${productId}/stock`);
        setData(res.data.data);
      } catch (err) {
        console.error('Error fetching stock breakdown:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, [productId]);

  if (!productId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Stock by Location</h3>
              <p className="text-xs text-slate-400">Derived from immutable stock ledger entries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
              Computing ledger sums across warehouses...
            </div>
          ) : data ? (
            <div>
              {/* Product Info Bar */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 mb-5">
                <div>
                  <h4 className="font-semibold text-slate-100 text-sm">{data.product.name}</h4>
                  <span className="text-xs font-mono text-slate-400">SKU: {data.product.sku}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Derived Stock</span>
                  <span className="text-2xl font-black text-brand-400">
                    {data.total_stock}{' '}
                    <span className="text-xs font-normal text-slate-300">
                      {data.product.unit_of_measure}
                    </span>
                  </span>
                </div>
              </div>

              {/* Location Breakdown Table */}
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                Warehouse Breakdown
              </h5>

              {data.locations.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs rounded-xl border border-dashed border-slate-800">
                  No stock has been recorded in any location yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                  {data.locations.map((loc) => (
                    <div
                      key={loc.location_id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-800/30 transition text-xs"
                    >
                      <div className="flex items-center space-x-3">
                        <MapPin className="w-4 h-4 text-brand-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-200">{loc.location_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {loc.warehouse_name}
                            {loc.parent_location_name && ` > ${loc.parent_location_name}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            loc.current_stock > 0 ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {loc.current_stock}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">
                          {data.product.unit_of_measure}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-rose-400 text-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
              Failed to load stock data.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
