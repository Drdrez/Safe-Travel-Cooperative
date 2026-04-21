const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPHP(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return phpFormatter.format(value);
}

export function parsePHP(amount: string): number {
  const n = parseFloat(amount.replace(/[₱,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function fromCents(cents: number | null | undefined): number {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return 0;
  return cents / 100;
}

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

export function toCents(amount: string | number | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  const n = typeof amount === 'number' ? amount : Number(String(amount).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
