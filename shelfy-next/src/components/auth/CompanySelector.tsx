'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Search, ArrowRight, ShieldCheck, ChevronRight } from 'lucide-react';
import { Company } from '@/lib/types';

interface CompanySelectorProps {
  initialCompanies: Company[];
}

export default function CompanySelector({ initialCompanies }: CompanySelectorProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = initialCompanies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.short_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by company name or short code (e.g. APEX)..."
          className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
        />
      </div>

      {/* Companies List */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No active organization matches &ldquo;{searchTerm}&rdquo;.
          </div>
        ) : (
          filtered.map((company) => (
            <Link
              key={company.id}
              href={`/${company.short_code.toLowerCase()}/login`}
              className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/60 hover:border-cyan-500/40 transition-all duration-200"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:bg-cyan-950/60 transition-all">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-white group-hover:text-cyan-400 transition-colors">
                    {company.name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] uppercase font-bold text-slate-300">
                      {company.short_code}
                    </span>
                    <span>&bull;</span>
                    <span className="text-emerald-400 text-[11px]">Active Tenant</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400 group-hover:text-cyan-400 transition-colors">
                <span className="text-xs font-medium hidden sm:inline">Enter Portal</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span>Need assistance? Contact your system admin</span>
        <span className="font-mono text-slate-400">{filtered.length} Organizations available</span>
      </div>
    </div>
  );
}
