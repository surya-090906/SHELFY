import Link from 'next/link';
import { Package, Building2, Search, ArrowRight, ShieldCheck } from 'lucide-react';
import CompanySelector from '@/components/auth/CompanySelector';
import { Company } from '@/lib/types';
import { createClient } from '@supabase/supabase-js';

// Pre-auth public query for active companies
async function getActiveCompanies(): Promise<Company[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Provide demo fallback companies if Supabase DB is offline during development
    return [
      {
        id: 'org_shelfy_demo_1',
        name: 'Apex Global Logistics',
        short_code: 'APEX',
        is_active: true,
        logo_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'org_shelfy_demo_2',
        name: 'Omni Retail Warehousing',
        short_code: 'OMNI',
        is_active: true,
        logo_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error || !data || data.length === 0) {
      return [
        {
          id: 'org_shelfy_demo_1',
          name: 'Apex Global Logistics',
          short_code: 'APEX',
          is_active: true,
          logo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'org_shelfy_demo_2',
          name: 'Omni Retail Warehousing',
          short_code: 'OMNI',
          is_active: true,
          logo_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    }
    return data;
  } catch {
    return [
      {
        id: 'org_shelfy_demo_1',
        name: 'Apex Global Logistics',
        short_code: 'APEX',
        is_active: true,
        logo_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }
}

export default async function HomePage() {
  const companies = await getActiveCompanies();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-lg shadow-cyan-500/20">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white font-mono">Shelfy</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                IMS
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/admin"
          className="text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Platform Admin</span>
        </Link>
      </header>

      {/* Main Hero & Company Selector */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Enterprise Multi-Tenant Inventory System
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Select Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-500">Organization</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto">
            Choose your company workspace to proceed to secure authenticated inventory operations.
          </p>
        </div>

        {/* Client Interactive Company Selector with Live Type-Ahead */}
        <div className="w-full max-w-xl">
          <CompanySelector initialCompanies={companies} />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div>&copy; {new Date().getFullYear()} Shelfy IMS &bull; Next.js + Supabase RLS + Clerk Organizations</div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>SMTP OTP Password Recovery</span>
          <span>&bull;</span>
          <span>Realtime Stock Ledger</span>
        </div>
      </footer>
    </div>
  );
}
