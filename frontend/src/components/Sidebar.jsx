import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  PackageCheck,
  ArrowLeftRight,
  SlidersHorizontal,
  History,
  Warehouse,
  Shield,
  Layers,
} from 'lucide-react';

export default function Sidebar({ currentTab, onNavigate }) {
  const { user } = useAuthStore();
  const isManager = user?.role === 'manager';

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['manager', 'staff'],
    },
    {
      id: 'products',
      label: 'Products & Stock',
      icon: Boxes,
      roles: ['manager', 'staff'],
    },
    {
      id: 'receipts',
      label: 'Receipts (Inbound)',
      icon: PackageCheck,
      roles: ['manager', 'staff'],
    },
    {
      id: 'deliveries',
      label: 'Delivery Orders',
      icon: Truck,
      roles: ['manager', 'staff'],
    },
    {
      id: 'transfers',
      label: 'Internal Transfers',
      icon: ArrowLeftRight,
      roles: ['manager', 'staff'],
    },
    {
      id: 'adjustments',
      label: 'Stock Adjustments',
      icon: SlidersHorizontal,
      roles: ['manager', 'staff'],
    },
    {
      id: 'move-history',
      label: 'Move History (Ledger)',
      icon: History,
      roles: ['manager', 'staff'],
    },
    {
      id: 'warehouses',
      label: 'Warehouses & Racks',
      icon: Warehouse,
      roles: ['manager'],
      badge: 'Manager',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900/60 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div className="p-4 space-y-6">
        {/* Core Architecture Notice Pill */}
        <div className="p-3 rounded-xl bg-brand-950/40 border border-brand-800/40">
          <div className="flex items-center space-x-2 text-brand-400 font-semibold text-[11px] uppercase tracking-wider mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Immutable Ledger</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Derived stock calculation active. Zero mutable stock fields.
          </p>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const hasAccess = item.roles.includes(user?.role);
            if (!hasAccess && item.badge) {
              return null; // Hide manager-only pages from staff
            }

            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition duration-150 group ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-4 h-4 transition ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && !isActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Role summary */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200">
              {isManager ? 'Full Privileges' : 'Staff Access'}
            </p>
            <p className="text-[10px] text-slate-500">
              {isManager ? 'Can create, edit & configure' : 'Operations & movements only'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
