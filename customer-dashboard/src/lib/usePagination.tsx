import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type Pagination<T> = {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  firstIndex: number;
  lastIndex: number;
  items: T[];
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  next: () => void;
  prev: () => void;
};

export function usePagination<T>(items: T[], defaultPageSize = 10): Pagination<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const firstIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastIndex  = Math.min(total, page * pageSize);

  return {
    page,
    pageSize,
    totalPages,
    total,
    firstIndex,
    lastIndex,
    items: pageItems,
    setPage: (p: number) => setPage(Math.min(Math.max(1, p), totalPages)),
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
    next: () => setPage(p => Math.min(totalPages, p + 1)),
    prev: () => setPage(p => Math.max(1, p - 1)),
  };
}

type TablePaginationProps = {
  pagination: Pagination<unknown>;
  label?: string;
  pageSizes?: number[];
  className?: string;
  style?: React.CSSProperties;
};

export function TablePagination({
  pagination,
  label = 'records',
  pageSizes = [10, 25, 50],
  className,
  style,
}: TablePaginationProps) {
  const { page, totalPages, total, firstIndex, lastIndex, pageSize, setPage, setPageSize, next, prev } = pagination;

  if (total === 0) return null;

  const pageNumbers = getPageWindow(page, totalPages);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 20px',
        borderTop: '1px solid var(--slate-100)',
        background: 'var(--slate-50)',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--slate-500)' }}>
        <span>
          Showing <strong style={{ color: 'var(--slate-700)' }}>{firstIndex}</strong>–
          <strong style={{ color: 'var(--slate-700)' }}>{lastIndex}</strong> of{' '}
          <strong style={{ color: 'var(--slate-700)' }}>{total}</strong> {label}
        </span>
        {pageSizes.length > 1 && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                border: '1px solid var(--slate-200)',
                borderRadius: 6,
                background: 'white',
                color: 'var(--slate-700)',
                cursor: 'pointer',
              }}
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <PgBtn onClick={prev} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={14} />
        </PgBtn>
        {pageNumbers.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} style={{ padding: '0 6px', color: 'var(--slate-400)', fontSize: 12 }}>…</span>
          ) : (
            <PgBtn
              key={p}
              onClick={() => setPage(p as number)}
              active={p === page}
              aria-label={`Page ${p}`}
            >
              {p}
            </PgBtn>
          ),
        )}
        <PgBtn onClick={next} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight size={14} />
        </PgBtn>
      </div>
    </div>
  );
}

function PgBtn({
  children,
  active,
  disabled,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      {...rest}
      style={{
        minWidth: 30,
        height: 30,
        padding: '0 8px',
        borderRadius: 8,
        border: '1px solid ' + (active ? 'var(--brand-gold)' : 'var(--slate-200)'),
        background: active ? 'var(--brand-gold)' : 'white',
        color: active ? 'var(--slate-900)' : 'var(--slate-600)',
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      {children}
    </button>
  );
}

function getPageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '…')[] = [1];
  const windowStart = Math.max(2, current - 1);
  const windowEnd   = Math.min(total - 1, current + 1);

  if (windowStart > 2) pages.push('…');
  for (let i = windowStart; i <= windowEnd; i++) pages.push(i);
  if (windowEnd < total - 1) pages.push('…');

  pages.push(total);
  return pages;
}
