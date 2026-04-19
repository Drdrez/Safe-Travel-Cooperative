const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatPHP = (amount: number | null | undefined) => {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return phpFormatter.format(value);
};

export const toCents = (amount: string | number | null | undefined) => {
  if (amount === null || amount === undefined) return 0;
  const n =
    typeof amount === 'number'
      ? amount
      : Number(String(amount).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

export const fromCents = (cents: number | null | undefined) => {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return 0;
  return cents / 100;
};
