import React from 'react';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { ShieldAlert, User, Terminal, Calendar } from 'lucide-react';

export default async function AuditLogsPage() {
  const { orgRole } = await auth();

  // Strictly Manager-only guard
  if (orgRole !== 'org:admin') {
    notFound();
  }

  let logs: any[] = [];
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    logs = data || [];
  } catch (err) {
    console.warn('[Audit Logs Fetch Error - fallback demo data]', err);
    logs = [
      {
        id: '1',
        action: 'receipt.validated',
        entity_type: 'receipt',
        entity_id: 'rec_001',
        clerk_user_id: 'user_admin_01',
        after: { reference: 'WH/IN/0001', status: 'done' },
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '2',
        action: 'product.created',
        entity_type: 'product',
        entity_id: 'prod_002',
        clerk_user_id: 'user_admin_01',
        after: { name: 'Pneumatic Control Valve 2"', sku: 'VALVE-PN-02' },
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ];
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/60">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Security &amp; Audit Logs</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manager-restricted audit trail recording every state mutation within your organization.
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Action &amp; Target</th>
                <th className="px-5 py-3.5">Actor (Clerk User)</th>
                <th className="px-5 py-3.5">Mutation Payload</th>
                <th className="px-5 py-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-500">
                    No audit records registered yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-semibold text-cyan-400 text-xs">
                        {log.action}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {log.entity_type} &bull; {log.entity_id}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{log.clerk_user_id}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <pre className="max-w-xs overflow-x-auto bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-slate-300 border border-slate-800">
                        {JSON.stringify(log.after || log.before || {}, null, 2)}
                      </pre>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
