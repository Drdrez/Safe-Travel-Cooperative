/**
 * Ambient typings so the workspace TypeScript server understands Deno `npm:` specifiers
 * used by Supabase Edge Functions (Deno resolves them at deploy/runtime; plain tsc does not).
 */
declare module 'npm:@supabase/supabase-js@2' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: Record<string, unknown>): any;
}
