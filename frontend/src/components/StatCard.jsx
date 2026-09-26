import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'brand', change }) {
  const colorMap = {
    brand: {
      border: 'hover:border-brand-500/40',
      iconBg: 'bg-brand-500/10 text-brand-400',
      glow: 'group-hover:shadow-brand-500/10',
    },
    rose: {
      border: 'hover:border-rose-500/40',
      iconBg: 'bg-rose-500/10 text-rose-400',
      glow: 'group-hover:shadow-rose-500/10',
    },
    amber: {
      border: 'hover:border-amber-500/40',
      iconBg: 'bg-amber-500/10 text-amber-400',
      glow: 'group-hover:shadow-amber-500/10',
    },
    emerald: {
      border: 'hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
      glow: 'group-hover:shadow-emerald-500/10',
    },
    indigo: {
      border: 'hover:border-indigo-500/40',
      iconBg: 'bg-indigo-500/10 text-indigo-400',
      glow: 'group-hover:shadow-indigo-500/10',
    },
  };

  const scheme = colorMap[color] || colorMap.brand;

  return (
    <div
      className={`glass-panel p-5 rounded-2xl border border-slate-800 transition duration-200 group ${scheme.border} ${scheme.glow} shadow-lg`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-xl ${scheme.iconBg}`}>
          <Icon className="w-5 h-5 stroke-[2]" />
        </div>
      </div>

      <div className="flex items-baseline space-x-2">
        <h3 className="text-3xl font-extrabold text-white tracking-tight">{value}</h3>
        {change && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
            {change}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-slate-500 mt-1.5 font-normal">{subtitle}</p>}
    </div>
  );
}
