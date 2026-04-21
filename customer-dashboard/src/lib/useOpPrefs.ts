import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type OpPrefs = {
  currency: string;
  tax_rate: number;
  buffer_minutes: number;
  default_daily_rate: number;
  cancellation_fee_pct: number;
  cancellation_window_hours: number;
  online_payments_enabled: boolean;
  enforce_cancellation_fee: boolean;
  maintenance_mode: boolean;
};

export const DEFAULT_OP_PREFS: OpPrefs = {
  currency: 'PHP',
  tax_rate: 12,
  buffer_minutes: 60,
  default_daily_rate: 3500,
  cancellation_fee_pct: 10,
  cancellation_window_hours: 2,
  online_payments_enabled: true,
  enforce_cancellation_fee: true,
  maintenance_mode: false,
};

export function useOpPrefs(): { prefs: OpPrefs; loading: boolean } {
  const [prefs, setPrefs] = useState<OpPrefs>(DEFAULT_OP_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'op_prefs')
        .maybeSingle();
      if (cancelled) return;
      const value = (data?.value ?? {}) as Partial<OpPrefs>;
      setPrefs({ ...DEFAULT_OP_PREFS, ...value });
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`op_prefs_changes_${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.op_prefs' },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { prefs, loading };
}
