import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Building2, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { CardSkeleton } from '@/components/Skeleton';
import { Footer } from '@/components/Footer';
import { Select } from '@/components/Select';
import { CITIES, LocationCard, type Location } from '@/pages/ExplorePage';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 50;

interface ApiResponse {
  items: Location[];
  total: number;
  page: number;
  pageSize: number;
  areas: string[];
}

/**
 * Full catalog page — listed at /spaces.
 *
 * Filter state is mirrored to URL query params (?city=&area=&q=) so the page is
 * shareable / bookmarkable and survives refresh. The ExplorePage "View all"
 * button drops the user here with the active city pre-applied.
 */
export const SpacesPage = () => {
  const [params, setParams] = useSearchParams();

  // Pull initial filter state from the URL.
  const urlCity = params.get('city') ?? '';
  const urlArea = params.get('area') ?? '';
  const urlQ    = params.get('q')    ?? '';

  // Local mirrors so typing in the search box doesn't fire on every keystroke.
  const [q, setQ] = useState(urlQ);

  // Debounce the free-text search → URL update.
  useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q.trim()) next.set('q', q.trim());
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // When the URL's q changes from elsewhere (back/forward, clear button), sync the input.
  useEffect(() => {
    if (urlQ !== q) setQ(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  const setCity = (city: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (city) next.set('city', city);
        else next.delete('city');
        // Changing city invalidates the previous area selection.
        next.delete('area');
        return next;
      },
      { replace: false },
    );
  };

  const setArea = (area: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (area) next.set('area', area);
        else next.delete('area');
        return next;
      },
      { replace: false },
    );
  };

  const clearAll = () => {
    setParams(new URLSearchParams(), { replace: false });
    setQ('');
  };

  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['spaces', urlCity, urlArea, urlQ],
    queryFn: async () => {
      const res = await api.get<ApiResponse>('/locations', {
        params: {
          city: urlCity || undefined,
          area: urlArea || undefined,
          q:    urlQ    || undefined,
          pageSize: PAGE_SIZE,
        },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const areas = useMemo(() => data?.areas ?? [], [data?.areas]);
  const hasFilter = Boolean(urlCity || urlArea || urlQ);

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb / back */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 dark:text-slate-400"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to home
        </Link>

        {/* Heading */}
        <div className="mt-3 flex flex-col gap-1">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            {urlCity ? `All parking in ${urlCity}` : 'All parking spaces'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Browse the full catalog. Filter by city or locality to narrow down.
          </p>
        </div>

        {/* Filter bar */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-3 sm:grid-cols-[1fr,1fr,2fr]">
            {/* City */}
            <div className="flex items-center rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60">
              <Select
                value={urlCity}
                onChange={(v) => setCity(v)}
                options={CITIES.map((c) => ({ value: c, label: c }))}
                placeholder="All cities"
                ariaLabel="Filter by city"
                leadingIcon={<MapPin className="h-4 w-4 text-slate-500" />}
                triggerClassName="w-full py-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Area / locality */}
            <div
              className={cn(
                'flex items-center rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60',
                areas.length === 0 && 'opacity-60',
              )}
            >
              <Select
                value={urlArea}
                onChange={(v) => setArea(v)}
                options={areas.map((a) => ({ value: a, label: a }))}
                placeholder={
                  areas.length === 0
                    ? urlCity
                      ? `No areas listed in ${urlCity}`
                      : 'Pick a city first'
                    : 'All localities'
                }
                disabled={areas.length === 0}
                ariaLabel="Filter by area or locality"
                leadingIcon={<Building2 className="h-4 w-4 text-slate-500" />}
                triggerClassName="w-full py-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Search */}
            <label className="relative flex items-center gap-2 rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, address, or area"
                aria-label="Search"
                className="w-full bg-transparent py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  aria-label="Clear search"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </div>

          {/* Active filter chips + clear */}
          {hasFilter && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active:</span>
              {urlCity && (
                <Chip label={urlCity} onRemove={() => setCity('')} />
              )}
              {urlArea && (
                <Chip label={urlArea} onRemove={() => setArea('')} />
              )}
              {urlQ && (
                <Chip label={`"${urlQ}"`} onRemove={() => setQ('')} />
              )}
              <button
                onClick={clearAll}
                className="ml-auto text-xs font-semibold text-brand-600 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mt-6 flex items-end justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isLoading
              ? 'Loading…'
              : `Showing ${items.length}${total > items.length ? ` of ${total}` : ''} space${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Grid */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          ) : items.length > 0 ? (
            items.map((l) => <LocationCard key={l.id} loc={l} />)
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No spaces match your filters.{' '}
                {hasFilter && (
                  <button onClick={clearAll} className="font-semibold text-brand-600 hover:underline">
                    Clear filters
                  </button>
                )}
              </p>
            </div>
          )}
        </div>

        {total > items.length && (
          <p className="mt-6 text-center text-xs text-slate-400">
            More than {items.length} spaces match. Refine your filters above to see them all.
          </p>
        )}

        {/* "List your space" CTA banner */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 p-6 text-white shadow-lg shadow-brand-600/20 sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">For property owners</p>
              <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">
                Got empty parking bays? Turn them into revenue.
              </h2>
              <p className="mt-1 text-sm text-white/80">
                List your space on AutoSahay in minutes — zero setup cost, weekly payouts.
              </p>
            </div>
            <Link
              to="/list-your-space"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow transition hover:bg-slate-100"
            >
              List your space →
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
};

const Chip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-300">
    {label}
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label} filter`}
      className="text-brand-500 hover:text-brand-700 dark:text-brand-400"
    >
      <X className="h-3 w-3" />
    </button>
  </span>
);
