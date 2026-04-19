/**
 * Small, timezone-safe date helpers. These format dates in the local timezone
 * by default, but every helper tolerates null/undefined/invalid inputs so the
 * UI never renders "Invalid Date" or crashes a list page.
 */

const safeDate = (input: string | number | Date | null | undefined): Date | null => {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (
  input: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
  fallback = '—'
): string => {
  const d = safeDate(input);
  if (!d) return fallback;
  return d.toLocaleDateString(undefined, opts);
};

export const formatDateTime = (
  input: string | number | Date | null | undefined,
  fallback = '—'
): string => {
  const d = safeDate(input);
  if (!d) return fallback;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Return local ISO day bucket, e.g. '2026-04-18' (stable across timezones on the client). */
export const localDayKey = (input: string | number | Date | null | undefined): string => {
  const d = safeDate(input);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Check whether two date inputs fall on the same local calendar day. */
export const isSameLocalDay = (
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined
): boolean => {
  const k1 = localDayKey(a);
  const k2 = localDayKey(b);
  return !!k1 && k1 === k2;
};

/** Difference in days between two dates (end - start), rounded down. */
export const daysBetween = (
  start: string | number | Date | null | undefined,
  end: string | number | Date | null | undefined
): number => {
  const s = safeDate(start);
  const e = safeDate(end);
  if (!s || !e) return 0;
  const ms = e.getTime() - s.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
};
