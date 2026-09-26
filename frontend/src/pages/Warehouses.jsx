import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, X, Edit2, Trash2, Warehouse, MapPin, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  // Warehouse form state
  const [showWhForm, setShowWhForm] = useState(false);
  const [editWh, setEditWh] = useState(null);
  const [whName, setWhName] = useState('');
  // Location form state
  const [showLocForm, setShowLocForm] = useState(false);
  const [locName, setLocName] = useState('');
  const [locWarehouseId, setLocWarehouseId] = useState('');
  const [locParentId, setLocParentId] = useState('');
  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');

  const [formError, setFormError] = useState(null);
  const [locations, setLocations] = useState([]);

  const fetch = async () => {
    setLoading(true);
    try {
      const [wRes, lRes, cRes] = await Promise.all([
        api.get('/warehouses'),
        api.get('/locations'),
        api.get('/categories'),
      ]);
      setWarehouses(wRes.data.data);
      setLocations(lRes.data.data);
      setCategories(cRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleWhSubmit = async (e) => {
    e.preventDefault(); setFormError(null);
    try {
      if (editWh) { await api.put(`/warehouses/${editWh.id}`, { name: whName }); }
      else { await api.post('/warehouses', { name: whName }); }
      setShowWhForm(false); setWhName(''); setEditWh(null); fetch();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed'); }
  };

  const handleDeleteWh = async (id) => {
    if (!window.confirm('Delete this warehouse? All empty locations will be removed.')) return;
    try { await api.delete(`/warehouses/${id}`); fetch(); }
    catch (err) { alert(err.response?.data?.message || 'Cannot delete'); }
  };

  const handleLocSubmit = async (e) => {
    e.preventDefault(); setFormError(null);
    try {
      await api.post('/locations', { warehouse_id: locWarehouseId, name: locName, parent_location_id: locParentId || null });
      setShowLocForm(false); setLocName(''); setLocWarehouseId(''); setLocParentId(''); fetch();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed'); }
  };

  const handleDeleteLoc = async (id) => {
    if (!window.confirm('Delete this location?')) return;
    try { await api.delete(`/locations/${id}`); fetch(); }
    catch (err) { alert(err.response?.data?.message || 'Cannot delete'); }
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault(); setFormError(null);
    try {
      await api.post('/categories', { name: catName });
      setShowCatForm(false); setCatName(''); fetch();
    } catch (err) { setFormError(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Warehouse & Location Setup</h1>
          <p className="text-xs text-slate-400 mt-1">Manager-only: Configure rack-level inventory locations and categories</p>
        </div>
        <button onClick={fetch} className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition">
          <RefreshCw className="w-3.5 h-3.5" /><span>Refresh</span>
        </button>
      </div>

      {/* Warehouses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300 flex items-center space-x-2"><Warehouse className="w-4 h-4 text-brand-400" /><span>Warehouses</span></h2>
          <button onClick={() => { setShowWhForm(true); setEditWh(null); setWhName(''); }} className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition">
            <Plus className="w-3.5 h-3.5" /><span>New Warehouse</span>
          </button>
        </div>

        {loading ? <div className="py-8 text-center text-slate-500 text-sm">Loading...</div> : (
          <div className="space-y-3">
            {warehouses.map(wh => {
              const whLocations = locations.filter(l => l.warehouse_id === wh.id);
              const isOpen = expanded[wh.id];
              return (
                <div key={wh.id} className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/30 transition" onClick={() => toggleExpand(wh.id)}>
                    <div className="flex items-center space-x-3">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400"><Warehouse className="w-4 h-4" /></div>
                      <div>
                        <p className="font-bold text-slate-200">{wh.name}</p>
                        <p className="text-[11px] text-slate-500">{whLocations.length} location(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={e => { e.stopPropagation(); setEditWh(wh); setWhName(wh.name); setShowWhForm(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteWh(wh.id); }} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-800 px-5 py-4 bg-slate-900/40">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Locations in {wh.name}</h4>
                        <button onClick={() => { setShowLocForm(true); setLocWarehouseId(String(wh.id)); setLocName(''); setLocParentId(''); }} className="flex items-center space-x-1 text-xs text-brand-400 hover:text-brand-300 transition"><Plus className="w-3 h-3" /><span>Add Location</span></button>
                      </div>
                      {whLocations.length === 0 ? (
                        <p className="text-xs text-slate-600 italic">No locations added yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {whLocations.map(loc => (
                            <div key={loc.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-900/80 border border-slate-800/60 text-xs">
                              <div className="flex items-center space-x-2">
                                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="text-slate-300">{loc.name}</span>
                                {loc.parent_location_id && <span className="text-[11px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Sub-location</span>}
                              </div>
                              <button onClick={() => handleDeleteLoc(loc.id)} className="p-1 rounded text-rose-400 hover:bg-rose-500/10 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {warehouses.length === 0 && <div className="text-center py-8 text-slate-500 text-xs">No warehouses configured yet.</div>}
          </div>
        )}
      </div>

      {/* Categories Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300">Product Categories</h2>
          <button onClick={() => { setShowCatForm(true); setCatName(''); }} className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition">
            <Plus className="w-3.5 h-3.5" /><span>New Category</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <div key={c.id} className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs">
              <span className="text-slate-200 font-semibold">{c.name}</span>
              <span className="text-slate-500">({c._count?.products || 0} products)</span>
            </div>
          ))}
          {categories.length === 0 && <div className="text-xs text-slate-500 italic">No categories created yet.</div>}
        </div>
      </div>

      {/* Warehouse Form Modal */}
      {showWhForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-slate-800 shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">{editWh ? 'Edit Warehouse' : 'New Warehouse'}</h3>
              <button onClick={() => setShowWhForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleWhSubmit} className="p-5 space-y-4">
              {formError && <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Warehouse Name *</label>
                <input required value={whName} onChange={e => setWhName(e.target.value)} placeholder="e.g. Main Distribution Center" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition" />
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setShowWhForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
                <button type="submit" className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition">{editWh ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Location Form Modal */}
      {showLocForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-slate-800 shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">Add Location</h3>
              <button onClick={() => setShowLocForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleLocSubmit} className="p-5 space-y-4">
              {formError && <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Location Name *</label>
                <input required value={locName} onChange={e => setLocName(e.target.value)} placeholder="e.g. Rack A-101" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Warehouse *</label>
                <select required value={locWarehouseId} onChange={e => setLocWarehouseId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition">
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Parent Location (optional)</label>
                <select value={locParentId} onChange={e => setLocParentId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm focus:outline-none focus:border-brand-500 transition">
                  <option value="">No parent (top-level)</option>
                  {locations.filter(l => l.warehouse_id === parseInt(locWarehouseId)).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setShowLocForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
                <button type="submit" className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition">Add Location</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCatForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-slate-800 shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white">New Category</h3>
              <button onClick={() => setShowCatForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCatSubmit} className="p-5 space-y-4">
              {formError && <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Category Name *</label>
                <input required value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Raw Materials" className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-brand-500 transition" />
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setShowCatForm(false)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Cancel</button>
                <button type="submit" className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
