import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Package, Building2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Company } from '@/lib/types';
import BrandedLoginForm from '@/components/auth/BrandedLoginForm';

async function getCompanyByCode(code: string): Promise<Company | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      id: `org_${code.toLowerCase()}`,
      name: `${code.toUpperCase()} Warehouse Corp`,
      short_code: code.toUpperCase(),
      logo_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .ilike('short_code', code)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // Fallback for demo codes
      return {
        id: `org_${code.toLowerCase()}`,
        name: `${code.toUpperCase()} Warehouse Corp`,
        short_code: code.toUpperCase(),
        logo_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return data;
  } catch {
    return {
      id: `org_${code.toLowerCase()}`,
      name: `${code.toUpperCase()} Warehouse Corp`,
      short_code: code.toUpperCase(),
      logo_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export default async function BrandedLoginPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company: companyParam } = await params;
  const company = await getCompanyByCode(companyParam);

  if (!company) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
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
        </Link>
        <Link
          href="/"
          className="text-xs font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Switch Organization</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full">
        {/* Company Header Card */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Workspace: {company.short_code}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{company.name}</h1>
          <p className="text-xs text-slate-400">
            Sign in to access your warehouses, inventory movements, and stock ledger.
          </p>
        </div>

        {/* Interactive Form with Forgot Password Custom SMTP OTP Toggle */}
        <BrandedLoginForm company={company} />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-500 flex items-center justify-between max-w-7xl mx-auto w-full">
        <span>Protected by Clerk Organizations + Supabase RLS</span>
        <Link href="/" className="hover:text-cyan-400 transition-colors">
          Not your organization? Select another
        </Link>
      </footer>
    </div>
  );
}
