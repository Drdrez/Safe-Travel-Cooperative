import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

type Handler = () => void | Promise<void>;

interface Options {
  filter?: string;
  debounceMs?: number;
  events?: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  enabled?: boolean;
}

export function useRealtimeRefresh(
  tables: string | string[],
  refresh: Handler,
  { filter, debounceMs = 150, events, enabled = true }: Options = {},
) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const list = Array.isArray(tables) ? tables : [tables];
    const channelName = `rt:${list.join(',')}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(channelName);

    let pending: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        pending = null;
        Promise.resolve(refreshRef.current()).catch(() => { /* swallow */ });
      }, debounceMs);
    };

    const wanted = events ?? (['INSERT', 'UPDATE', 'DELETE'] as const);

    for (const table of list) {
      for (const ev of wanted) {
        channel.on(
          'postgres_changes' as any,
          { event: ev, schema: 'public', table, ...(filter ? { filter } : {}) },
          trigger,
        );
      }
    }

    channel.subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(tables) ? tables.join(',') : tables, filter, enabled, debounceMs, (events ?? []).join(',')]);
}
