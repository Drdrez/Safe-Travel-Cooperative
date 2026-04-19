import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

type Handler = () => void | Promise<void>;

interface Options {
  /** Any postgres `WHERE`-style filter accepted by Supabase Realtime, e.g. `user_id=eq.<uid>`. */
  filter?: string;
  /** Coalesce bursts of events so `refresh()` isn't hammered. Default 150ms. */
  debounceMs?: number;
  /** Events to listen for. Default: all. */
  events?: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  /** Set to false to temporarily disable the subscription (e.g. until auth loads). */
  enabled?: boolean;
}

/**
 * Subscribe to Postgres changes on a public-schema table and call `refresh()`
 * whenever a row is inserted, updated, or deleted. Use this on list screens
 * so they stay in sync with mutations made elsewhere (other tabs, DB triggers,
 * the customer app changing state the admin is looking at, etc.).
 *
 * The caller owns `refresh`; wrap it in `useCallback` if it has its own deps.
 */
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
          // The Supabase types narrow `event` to the union, so cast here.
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
    // We intentionally re-subscribe when the filter or the table set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(tables) ? tables.join(',') : tables, filter, enabled, debounceMs, (events ?? []).join(',')]);
}
