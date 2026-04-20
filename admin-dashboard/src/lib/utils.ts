export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/** Edge Functions often return `{ error: string }`; `functions.invoke` may still set `error` on non-2xx, so prefer the response body message when present. */
export function edgeFunctionErrorMessage(data: unknown, invokeError: { message: string } | null): string | null {
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === 'string' && e.trim()) return e;
  }
  if (invokeError?.message) return invokeError.message;
  return null;
}
