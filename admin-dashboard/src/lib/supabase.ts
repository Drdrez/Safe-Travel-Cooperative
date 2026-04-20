import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Surface a clear, actionable error in dev rather than failing silently at runtime.
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Create a .env file in admin-dashboard/ with these values, then restart `npm run dev`.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

type CreateStaffResponse = { id: string; error?: string };

/**
 * POSTs to an Edge Function and parses JSON so `{ error: "..." }` from the function
 * is shown. `supabase.functions.invoke` often surfaces only "Edge Function returned a non-2xx status code".
 */
export async function invokeEdgeFunction<T = CreateStaffResponse>(
  functionName: string,
  body: unknown,
): Promise<{ data: T | null; error: string | null }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { data: null, error: 'Missing Supabase URL or anon key.' };
  }

  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (sessErr || !token) {
    return { data: null, error: 'Your session has expired. Please sign in again.' };
  }

  const base = supabaseUrl.replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { data: null, error: msg };
  }

  let parsed: unknown = null;
  try {
    const text = await res.text();
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return { data: null, error: res.statusText || `Request failed (${res.status})` };
  }

  if (parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
    const err = (parsed as { error?: unknown }).error;
    if (typeof err === 'string' && err.trim()) {
      return { data: null, error: err };
    }
  }

  if (!res.ok) {
    return { data: null, error: `Request failed (${res.status})` };
  }

  return { data: parsed as T, error: null };
}
