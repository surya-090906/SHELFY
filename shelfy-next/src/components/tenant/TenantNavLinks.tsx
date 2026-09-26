'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { clsx } from 'clsx';

interface TenantNavLinksProps {
  isManager: boolean;
}

export default function TenantNavLinks({ isManager }: TenantNavLinksProps) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/products', label: 'Products', icon: Boxes },
    { href: '/receipts', label: 'Receipts (WH/IN)', icon: ArrowDownToLine },
    { href: '/deliveries', label: 'Deliveries (WH/OUT)', icon: ArrowUpFromLine },
    { href: '/transfers', label: 'Transfers (WH/INT)', icon: ArrowLeftRight },
    { href: '/move-history', label: 'Move History', icon: History },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  if (isManager) {
    links.push({ href: '/audit-logs', label: 'Audit Logs', icon: ShieldAlert });
  }

  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all',
              isActive
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
            )}
          >
            <Icon className={clsx('w-4 h-4', isActive ? 'text-cyan-400' : 'text-slate-500')} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
