import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import {
  Package,
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  Settings,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import TenantNavLinks from '@/components/tenant/TenantNavLinks';

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId, orgRole, orgSlug } = await auth();

  if (!userId) {
    redirect('/');
  }

  const user = await currentUser();
  const isManager = orgRole === 'org:admin';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-md shadow-cyan-500/20">
              <Package className="w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight text-lg text-white font-mono">Shelfy</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              IMS
            </span>
          </Link>

          {/* Clerk Organization Switcher */}
          <div className="hidden sm:block">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterLeaveOrganizationUrl="/"
              appearance={{
                elements: {
                  rootBox: 'text-xs',
                  organizationSwitcherTrigger:
                    'bg-slate-900 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-800 transition-colors',
                  organizationPreviewTextContainer: 'text-xs text-slate-200 font-medium',
                },
              }}
            />
          </div>
        </div>

        {/* Right Action Icons & User Button */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400 font-mono text-[11px]">
              Role: <strong className="text-white">{isManager ? 'Inventory Manager' : 'Warehouse Staff'}</strong>
            </span>
          </div>

          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: 'w-8 h-8 rounded-full border border-slate-700',
              },
            }}
          />
        </div>
      </header>

      {/* Main Body with Sidebar + Page View */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-800 bg-slate-950/60 p-4 hidden md:flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 mb-2">
                Operations
              </div>
              <TenantNavLinks isManager={isManager} />
            </div>
          </div>

          {/* Bottom Sidebar Info */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-1">
            <div className="font-semibold text-slate-300">Tenant Isolation</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Row-Level Security enforced via Clerk Organization JWT.
            </p>
          </div>
        </aside>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
