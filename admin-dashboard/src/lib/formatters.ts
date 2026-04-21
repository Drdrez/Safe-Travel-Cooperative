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

export function formatPHPForPdf(amount: number | null | undefined): string {
  const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatVehicleLine(v: { model?: string | null; plate_number?: string | null } | null | undefined): string | null {
  if (!v) return null;
  const m = v.model?.trim();
  const p = v.plate_number?.trim();
  if (!m && !p) return null;
  if (m && p) return `${m} · ${p}`;
  return m || p || null;
}
