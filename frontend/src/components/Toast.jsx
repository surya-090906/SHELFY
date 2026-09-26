import React from 'react';
import { useSocketStore } from '../store/useSocketStore';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { activeToast, clearToast } = useSocketStore();

  if (!activeToast) return null;

  const icons = {
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-brand-400 shrink-0" />,
  };

  const borders = {
    warning: 'border-amber-500/40 bg-slate-900/95 shadow-amber-500/10',
    success: 'border-emerald-500/40 bg-slate-900/95 shadow-emerald-500/10',
    info: 'border-brand-500/40 bg-slate-900/95 shadow-brand-500/10',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div
        className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-md flex items-start space-x-3 ${
          borders[activeToast.type] || borders.info
        }`}
      >
        {icons[activeToast.type] || icons.info}
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-white mb-0.5">{activeToast.title}</h4>
          <p className="text-xs text-slate-300 leading-relaxed">{activeToast.message}</p>
        </div>
        <button
          onClick={clearToast}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
