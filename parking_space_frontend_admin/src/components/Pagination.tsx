import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Shape every paginated admin endpoint returns next to `items`. */
export interface PageInfo {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const ADMIN_PAGE_SIZE = 25;

/**
 * Page state for a server-paginated list. Goes back to page 1 whenever any of
 * `resetOn` changes (a filter, tab or search), so a filter never lands on an
 * empty page 7.
 */
export const usePage = (resetOn: unknown[]) => {
  const [page, setPage] = useState(1);
  const key = JSON.stringify(resetOn);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPage(1);
  }, [key]);
  return [page, setPage] as const;
};

/** Page numbers to show: first, last, current ±1, with gaps as null. */
const pageList = (page: number, count: number): (number | null)[] => {
  const keep = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
};

export const Pagination = ({
  info, onPage, isFetching, noun = 'items',
}: { info?: PageInfo; onPage: (page: number) => void; isFetching?: boolean; noun?: string }) => {
  if (!info || info.total === 0) return null;
  const { page, pageCount, total, pageSize } = info;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (p: number) => {
    onPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm', isFetching && 'opacity-70')}
    >
      <p className="text-slate-500 dark:text-slate-400">
        Showing <b className="font-semibold text-slate-700 dark:text-slate-200">{from}–{to}</b> of{' '}
        <b className="font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString('en-IN')}</b> {noun}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(page - 1)}
            disabled={page <= 1}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 font-medium text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          {pageList(page, pageCount).map((n, i) =>
            n === null ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => go(n)}
                aria-current={n === page ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-8 rounded-lg px-2 font-medium transition',
                  n === page
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => go(page + 1)}
            disabled={page >= pageCount}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 font-medium text-slate-600 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </nav>
  );
};
