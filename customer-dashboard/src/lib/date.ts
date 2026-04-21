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

export const hoursUntil = (input: string | number | Date | null | undefined): number => {
  const d = safeDate(input);
  if (!d) return Infinity;
  return (d.getTime() - Date.now()) / 3_600_000;
};
