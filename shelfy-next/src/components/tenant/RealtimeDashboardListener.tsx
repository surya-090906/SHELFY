'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Radio } from 'lucide-react';

interface RealtimeDashboardListenerProps {
  companyId: string;
}

export default function RealtimeDashboardListener({ companyId }: RealtimeDashboardListenerProps) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!companyId) return;

    // Subscribe to Supabase Realtime changes on stock_ledger
    const channel = supabaseBrowser
      .channel(`tenant-dashboard-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_ledger',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          console.log('[Supabase Realtime Event: stock_ledger]', payload);
          // Refresh the Server Component data automatically
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_orders',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive(true);
        } else {
          setLive(false);
        }
      });

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [companyId, router]);

  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
      <Radio className={`w-3.5 h-3.5 ${live ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
      <span>{live ? 'Supabase Realtime Connected' : 'Realtime Sync Standby'}</span>
    </div>
  );
}
