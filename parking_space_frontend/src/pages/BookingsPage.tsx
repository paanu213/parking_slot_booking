import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarX, MapPin, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { inr } from '@/lib/format';
import { Skeleton } from '@/components/Skeleton';

interface Booking {
  id: string;
  reference: string;
  status: string;
  startAt: string;
  endAt: string;
  totalAmount: string | number;
  slot?: { code?: string; location?: { name?: string } };
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
  CONFIRMED: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  COMPLETED: 'bg-brand-100 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100',
  FAILED: 'bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200',
};

export const BookingsPage = () => {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => (await api.get<{ items: Booking[] }>('/bookings/mine')).data,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header>
        <h1 className="font-display text-2xl font-bold">My bookings</h1>
        <p className="mt-1 text-sm text-slate-500">Upcoming, past, and pending payments — all in one place.</p>
      </header>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : isError ? (
          <div className="card p-6 text-center text-sm">
            <p className="text-rose-600 dark:text-rose-400">Couldn't load your bookings.</p>
            <p className="mt-1 text-xs text-slate-500">{errorMessage(error)}</p>
            <button className="btn-ghost mt-4 border border-slate-200 dark:border-slate-700" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : data && data.items.length ? (
          data.items.map((b) => <BookingRow key={b.id} b={b} />)
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
};

const BookingRow = ({ b }: { b: Booking }) => (
  <div className="card flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-slate-400" />
        <span className="truncate font-semibold">{b.slot?.location?.name ?? '—'}</span>
      </div>
      <div className="mt-1 text-xs text-slate-500">
        Slot {b.slot?.code ?? '—'} ·{' '}
        {new Date(b.startAt).toLocaleString()} → {new Date(b.endAt).toLocaleString()}
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
        <Receipt className="h-3 w-3" />
        Ref: {b.reference}
      </div>
    </div>
    <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[b.status] ?? STATUS_COLOR.CANCELLED}`}>
        {STATUS_LABEL[b.status] ?? b.status}
      </span>
      <div className="text-right">
        <div className="font-semibold">{inr(Number(b.totalAmount))}</div>
        {b.status === 'PENDING_PAYMENT' && (
          <Link to={`/checkout/${b.id}`} className="btn-primary mt-2 py-1 text-xs">
            Pay now
          </Link>
        )}
      </div>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="card flex flex-col items-center p-10 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
      <CalendarX className="h-5 w-5" />
    </span>
    <p className="mt-3 text-sm font-semibold">No bookings yet</p>
    <p className="mt-1 text-xs text-slate-500">When you reserve a slot, it'll show up here.</p>
    <Link to="/" className="btn-primary mt-4 text-xs">
      Find parking
    </Link>
  </div>
);
