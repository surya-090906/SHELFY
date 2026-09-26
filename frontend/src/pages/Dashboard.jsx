import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useSocketStore } from '../store/useSocketStore';
import StatCard from '../components/StatCard';
import {
  Boxes,
  AlertTriangle,
  PackageCheck,
  Truck,
  ArrowLeftRight,
  TrendingUp,
  PieChart as PieIcon,
  RefreshCw,
  PlusCircle,
  Clock,
  ArrowUpRight,
  Database,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export default function Dashboard({ onNavigate }) {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { notifications } = useSocketStore();

  const fetchKPIs = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await api.get('/dashboard/kpis');
      setKpis(res.data.data);
    } catch (err) {
      console.error('Failed to load KPIs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
  }, []);

  // When live events occur on socket, refresh KPIs
  useEffect(() => {
    if (notifications.length > 0) {
      fetchKPIs();
    }
  }, [notifications.length]);

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading live inventory metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Operational Overview
            </h1>
            <span className="flex items-center space-x-1 text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 font-mono">
              <Database className="w-3 h-3" />
              <span>Redis Cached (30s)</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time derived stock across warehouses, racks, and operational staging.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchKPIs(true)}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Feed'}</span>
          </button>

          <button
            onClick={() => onNavigate('receipts')}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/25 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Receipt</span>
          </button>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Products"
          value={kpis?.totalProducts || 0}
          subtitle="Catalog active items"
          icon={Boxes}
          color="brand"
        />

        <StatCard
          title="Low / Out of Stock"
          value={(kpis?.lowStockCount || 0) + (kpis?.outOfStockCount || 0)}
          subtitle={`${kpis?.outOfStockCount || 0} depleted, ${kpis?.lowStockCount || 0} below threshold`}
          icon={AlertTriangle}
          color={(kpis?.lowStockCount || 0) + (kpis?.outOfStockCount || 0) > 0 ? 'rose' : 'emerald'}
        />

        <StatCard
          title="Pending Receipts"
          value={kpis?.pendingReceipts || 0}
          subtitle="Inbound awaiting validation"
          icon={PackageCheck}
          color="amber"
        />

        <StatCard
          title="Pending Deliveries"
          value={kpis?.pendingDeliveries || 0}
          subtitle="Orders awaiting dispatch"
          icon={Truck}
          color="indigo"
        />

        <StatCard
          title="Scheduled Transfers"
          value={kpis?.scheduledTransfers || 0}
          subtitle="Cross-location moves"
          icon={ArrowLeftRight}
          color="emerald"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Movement Activity Trend Area Chart */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Stock Movement Dynamics (Past 7 Days)</h3>
                <p className="text-xs text-slate-400">Aggregated quantities moved via ledger records</p>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpis?.movementTrends || []}>
                <defs>
                  <linearGradient id="receiptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="deliveryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="transferGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => val.slice(5)}
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="receipt"
                  name="Receipts (+)"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#receiptGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="delivery"
                  name="Deliveries (-)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#deliveryGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="transfer"
                  name="Transfers"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#transferGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Stock Distribution Pie Chart */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                <PieIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Stock by Category</h3>
                <p className="text-xs text-slate-400">Units on hand across catalog</p>
              </div>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={kpis?.categoryDistribution || []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {(kpis?.categoryDistribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80">
            <button
              onClick={() => onNavigate('products')}
              className="w-full flex items-center justify-between text-xs text-brand-400 hover:text-brand-300 font-semibold transition"
            >
              <span>View full inventory catalog</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Access Operational Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('receipts')}
          className="glass-card p-5 rounded-2xl text-left border border-slate-800 hover:border-brand-500/40 transition group"
        >
          <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400 w-fit mb-3 group-hover:scale-110 transition">
            <PackageCheck className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Receive Stock</h4>
          <p className="text-xs text-slate-400 mt-1">Process supplier receipts into warehouse racks</p>
        </button>

        <button
          onClick={() => onNavigate('deliveries')}
          className="glass-card p-5 rounded-2xl text-left border border-slate-800 hover:border-brand-500/40 transition group"
        >
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-3 group-hover:scale-110 transition">
            <Truck className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Fulfill Deliveries</h4>
          <p className="text-xs text-slate-400 mt-1">Pick, pack, and validate customer orders</p>
        </button>

        <button
          onClick={() => onNavigate('transfers')}
          className="glass-card p-5 rounded-2xl text-left border border-slate-800 hover:border-brand-500/40 transition group"
        >
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-3 group-hover:scale-110 transition">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Internal Transfer</h4>
          <p className="text-xs text-slate-400 mt-1">Relocate stock between racks and zones</p>
        </button>

        <button
          onClick={() => onNavigate('adjustments')}
          className="glass-card p-5 rounded-2xl text-left border border-slate-800 hover:border-brand-500/40 transition group"
        >
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 w-fit mb-3 group-hover:scale-110 transition">
            <Clock className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Cycle Count Audit</h4>
          <p className="text-xs text-slate-400 mt-1">Reconcile physical stock against ledger sums</p>
        </button>
      </div>
    </div>
  );
}
