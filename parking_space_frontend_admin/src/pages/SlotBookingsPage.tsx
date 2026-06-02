import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarCheck, CheckCircle2, XCircle, IndianRupee,
  Clock, CalendarRange, Globe, UserCheck, MapPin, Building2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/pricing';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';

const STATUS_CLS: Record<string, string> = {
  CONFIRMED:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING_PAYMENT: 'bg-amber-100   text-amber-800   dark:bg-amber-900/30   dark:text-amber-300',
  CANCELLED:       'bg-red-100     text-red-800     dark:bg-red-900/30     dark:text-red-300',
  COMPLETED:       'bg-slate-100   text-slate-600   dark:bg-slate-800      dark:text-slate-400',
  FAILED:          'bg-red-100     text-red-800     dark:bg-red-900/30     dark:text-red-300',
};

type Tense = 'UPCOMING' | 'ACTIVE' | 'PAST';
const getTense = (startAt: string, endAt: string): Tense => {
  const now = Date.now();
  if (now < new Date(startAt).getTime()) return 'UPCOMING';
  if (now > new Date(endAt).getTime())   return 'PAST';
  return 'ACTIVE';
};
const TENSE_META: Record<Tense, { label: string; cls: string }> = {
  UPCOMING: { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  ACTIVE:   { label: 'Active',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  PAST:     { label: 'Past',     cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

// ── Page ──────────────────────────────────────────────────────────────────────
export const SlotBookingsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Where "back" should go — passed from the originating page
  const backTo = searchParams.get('backTo') ?? '/spaces';

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-slot-bookings', id],
    queryFn: async () => (await api.get(`/admin/slots/${id}/bookings`)).data,
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <section className="space-y-4 p-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-60 w-full" />
      </section>
    );
  }

  if (error || !data?.slot) {
    return (
      <section className="p-6">
        <button
          onClick={() => navigate(backTo)}
          className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <div className="card p-10 text-center text-sm text-red-500">Slot not found.</div>
      </section>
    );
  }

  const slot  = data.slot;
  const stats = data.stats ?? {};
  const bookings: any[] = data.bookings ?? [];

  // Surface active/upcoming first; cancelled & past sink to the bottom.
  const tenseRank: Record<string, number> = { ACTIVE: 0, UPCOMING: 1, PAST: 2 };
  const sorted = [...bookings].sort((a, b) => {
    const aCancel = a.status === 'CANCELLED' ? 1 : 0;
    const bCancel = b.status === 'CANCELLED' ? 1 : 0;
    if (aCancel !== bCancel) return aCancel - bCancel;
    const ra = tenseRank[getTense(a.startAt, a.endAt)];
    const rb = tenseRank[getTense(b.startAt, b.endAt)];
    if (ra !== rb) return ra - rb;
    const at = new Date(a.startAt).getTime();
    const bt = new Date(b.startAt).getTime();
    return ra === 2 ? bt - at : at - bt;
  });

  const upcomingCount = bookings.filter((b) => b.status !== 'CANCELLED' && getTense(b.startAt, b.endAt) === 'UPCOMING').length;
  const activeCount   = bookings.filter((b) => b.status !== 'CANCELLED' && getTense(b.startAt, b.endAt) === 'ACTIVE').length;

  return (
    <section className="space-y-5 p-6">
      {/* Top bar */}
      <div>
        <button
          onClick={() => navigate(backTo)}
          className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Slot {slot.code}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            ₹{Number(slot.hourlyPrice).toLocaleString('en-IN')}/hr
            {slot.monthlyPrice != null && Number(slot.monthlyPrice) > 0 && (
              <> · ₹{Number(slot.monthlyPrice).toLocaleString('en-IN')}/mo</>
            )}
          </span>
        </div>
        <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
          <Building2 className="h-4 w-4 text-brand-500" />
          {slot.location?.name}
          {slot.location?.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {slot.location.city}, {slot.location.state}
            </span>
          )}
          {slot.location?.vendor?.businessName && <>· {slot.location.vendor.businessName}</>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<CalendarCheck className="h-4 w-4 text-brand-500" />}    label="Total Bookings"      value={stats.total ?? 0} />
        <StatTile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}    label="Confirmed / Completed" value={stats.confirmed ?? 0} />
        <StatTile icon={<XCircle className="h-4 w-4 text-red-500" />}            label="Cancelled"           value={stats.cancelled ?? 0} />
        <StatTile icon={<IndianRupee className="h-4 w-4 text-amber-500" />}      label="Revenue"             value={formatINR(stats.revenue ?? 0)} />
      </div>

      {/* Bookings */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">
            Bookings <span className="text-slate-400">({bookings.length})</span>
          </h2>
          {(activeCount > 0 || upcomingCount > 0) && (
            <div className="flex items-center gap-2 text-[11px]">
              {activeCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {activeCount} active now
                </span>
              )}
              {upcomingCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {upcomingCount} upcoming
                </span>
              )}
            </div>
          )}
        </div>

        {bookings.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No bookings for this slot yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Plan</th>
                  <th>When</th>
                  <th>Customer</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => {
                  const isMonthly = b.bookingType === 'MONTHLY';
                  const tense     = getTense(b.startAt, b.endAt);
                  const tenseMeta = TENSE_META[tense];
                  const customerName = b.isDirectBooking
                    ? (b.guestName ?? 'Walk-in Guest')
                    : (b.user?.fullName ?? '—');
                  const customerSub = b.isDirectBooking
                    ? (b.guestPhone ?? '')
                    : (b.user?.email ?? '');
                  return (
                    <tr key={b.id}>
                      <td className="font-mono text-xs text-slate-500">{b.reference}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isMonthly
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {isMonthly ? <><CalendarRange className="h-2.5 w-2.5" /> Monthly</> : <><Clock className="h-2.5 w-2.5" /> Hourly</>}
                        </span>
                        {b.isDirectBooking ? (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            <UserCheck className="h-2.5 w-2.5" /> Walk-in
                          </span>
                        ) : (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <Globe className="h-2.5 w-2.5" /> Online
                          </span>
                        )}
                      </td>
                      <td>
                        {b.status !== 'CANCELLED' && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tenseMeta.cls}`}>
                            {tenseMeta.label}
                          </span>
                        )}
                      </td>
                      <td>
                        <p className="text-sm font-medium">{customerName}</p>
                        {customerSub && <p className="text-xs text-slate-400">{customerSub}</p>}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(b.startAt)}</td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(b.endAt)}</td>
                      <td className="font-semibold">{formatINR(Number(b.totalAmount))}</td>
                      <td>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[b.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {b.status === 'PENDING_PAYMENT' ? 'Pending' : b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                        </span>
                        {b.status === 'CANCELLED' && b.cancelReason && (
                          <p className="mt-0.5 max-w-[140px] truncate text-[10px] text-slate-400" title={b.cancelReason}>
                            {b.cancelReason}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

const StatTile = ({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: number | string }) => (
  <div className="card p-4">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
    <div className="mt-1 text-xl font-bold">{value}</div>
  </div>
);
