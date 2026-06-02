import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, Phone, Calendar, CalendarCheck, IndianRupee,
  ShieldCheck, MapPin, Car, UserRound, UserCheck, Clock,
  CheckCircle2, XCircle, CalendarRange, Globe, Ban, Pencil,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/pricing';
import { KebabMenu, MenuItem } from '@/components/KebabMenu';
import {
  CancelBookingModal, EditBookingModal, type EditBookingForm,
} from '@/components/BookingModals';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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

const ACCOUNT_STATUS_CLS: Record<string, string> = {
  ACTIVE:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  INACTIVE: 'bg-slate-200   text-slate-700   dark:bg-slate-700       dark:text-slate-300',
};

const canCancel = (status: string) => ['CONFIRMED', 'PENDING_PAYMENT'].includes(status);

// Classify a booking's window relative to now (only meaningful for non-cancelled bookings).
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
export const CustomerDetailsPage = () => {
  const { id, phone } = useParams<{ id?: string; phone?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Kind is inferred from the route param that's present
  const kind: 'registered' | 'guest' = id ? 'registered' : 'guest';
  const queryKey   = ['admin-customer', kind, id ?? phone];
  const queryUrl   = kind === 'registered'
    ? `/admin/customers/${id}`
    : `/admin/customers/guest/${encodeURIComponent(phone ?? '')}`;

  const qc = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [editTarget, setEditTarget]     = useState<any | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => (await api.get(queryUrl)).data,
    enabled: Boolean(id || phone),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const cancel = useMutation({
    mutationFn: ({ id: bid, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/bookings/${bid}/cancel`, { reason: reason || undefined }),
    onSuccess: () => { invalidate(); setCancelTarget(null); },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Failed to cancel booking.');
    },
  });

  const editBooking = useMutation({
    mutationFn: ({ id: bid, data: form }: { id: string; data: EditBookingForm }) => {
      const payload: any = { ...form };
      if (form.bookingType === 'MONTHLY') delete payload.endAt;
      return api.patch(`/admin/bookings/${bid}/guest`, payload).then((r) => r.data);
    },
    onSuccess: () => { invalidate(); setEditTarget(null); },
    onError: (err: any) => {
      alert(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Failed to save changes.');
    },
  });

  // Optional: name hint passed via ?name=... so we can render something before fetch resolves
  const fallbackName = searchParams.get('name') ?? '';

  if (isLoading) {
    return (
      <section className="space-y-4 p-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 w-full" />
        <div className="skeleton h-60 w-full" />
      </section>
    );
  }

  if (error || !data?.customer) {
    const apiMsg =
      (error as any)?.response?.data?.error?.message ??
      (error as any)?.response?.data?.message ??
      (error as any)?.message;
    const status = (error as any)?.response?.status;

    return (
      <section className="p-6">
        <button
          onClick={() => navigate('/customers')}
          className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Customers
        </button>
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-red-500">
            Could not load customer details.
          </p>
          {apiMsg && (
            <p className="mt-2 text-xs text-slate-500">
              {status ? `${status}: ` : ''}{apiMsg}
            </p>
          )}
          <p className="mt-3 text-[11px] text-slate-400">
            Endpoint: <code className="font-mono">GET {queryUrl}</code>
          </p>
        </div>
      </section>
    );
  }

  const c: any = data.customer;
  const stats  = data.stats ?? {};
  const bookings: any[] = data.bookings ?? [];

  // Surface current/upcoming bookings first; cancelled & past fall to the bottom.
  const tenseRank: Record<string, number> = { ACTIVE: 0, UPCOMING: 1, PAST: 2 };
  const sortedBookings = [...bookings].sort((a, b) => {
    const aCancel = a.status === 'CANCELLED' ? 1 : 0;
    const bCancel = b.status === 'CANCELLED' ? 1 : 0;
    if (aCancel !== bCancel) return aCancel - bCancel;
    const ra = tenseRank[getTense(a.startAt, a.endAt)];
    const rb = tenseRank[getTense(b.startAt, b.endAt)];
    if (ra !== rb) return ra - rb;
    // Within the same bucket: upcoming/active ascending, past descending
    const at = new Date(a.startAt).getTime();
    const bt = new Date(b.startAt).getTime();
    return ra === 2 ? bt - at : at - bt;
  });

  const upcomingCount = bookings.filter(
    (b) => b.status !== 'CANCELLED' && getTense(b.startAt, b.endAt) === 'UPCOMING',
  ).length;
  const activeCount = bookings.filter(
    (b) => b.status !== 'CANCELLED' && getTense(b.startAt, b.endAt) === 'ACTIVE',
  ).length;

  const displayName  = c.fullName ?? c.name ?? fallbackName ?? '—';
  const displayPhone = c.phone ?? '—';

  return (
    <section className="space-y-5 p-6">
      {/* ── Top bar ── */}
      <div>
        <button
          onClick={() => navigate('/customers')}
          className="mb-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Customers
        </button>

        <div className="flex flex-wrap items-start gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold ${
            kind === 'registered'
              ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}>
            {(displayName?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {kind === 'registered' ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
                    <UserRound className="h-3 w-3" /> Registered
                  </span>
                  {c.status && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ACCOUNT_STATUS_CLS[c.status] ?? ACCOUNT_STATUS_CLS.INACTIVE}`}>
                      {c.status}
                    </span>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <UserCheck className="h-3 w-3" /> Walk-in Guest
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {kind === 'registered'
                ? <>Registered {fmtDate(c.createdAt)} · Customer ID <span className="font-mono">{c.id}</span></>
                : <>First seen {fmtDate(c.firstSeen)} · Last seen {fmtDate(c.lastSeen)}</>
              }
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<CalendarCheck className="h-4 w-4 text-brand-500" />}
                  label="Total Bookings"
                  value={stats.bookingsTotal ?? 0} />
        <StatTile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  label="Confirmed / Completed"
                  value={stats.bookingsConfirmed ?? 0} />
        <StatTile icon={<XCircle className="h-4 w-4 text-red-500" />}
                  label="Cancelled"
                  value={stats.bookingsCancelled ?? 0} />
        <StatTile icon={<IndianRupee className="h-4 w-4 text-amber-500" />}
                  label="Total Spent"
                  value={formatINR(stats.totalSpent ?? 0)}
                  sub="Confirmed + completed" />
      </div>

      {/* ── Profile details ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contact info */}
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Contact Details</h2>
          <dl className="space-y-2 text-sm">
            <DetailRow icon={<UserRound className="h-3.5 w-3.5" />}
                       label={kind === 'registered' ? 'Full Name' : 'Guest Name'}
                       value={displayName} />
            <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={displayPhone} />
            {kind === 'registered' && (
              <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={
                <span className="inline-flex items-center gap-1.5">
                  {c.email ?? '—'}
                  {c.emailVerified
                    ? <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                      </span>
                    : <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Unverified
                      </span>}
                </span>
              } />
            )}
            {kind === 'registered' && c.provider && c.provider !== 'EMAIL' && (
              <DetailRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Sign-in via" value={c.provider} />
            )}
            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />}
                       label={kind === 'registered' ? 'Registered' : 'First Booking'}
                       value={fmtDate(kind === 'registered' ? c.createdAt : c.firstSeen)} />
            {kind === 'guest' && (
              <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Last Booking" value={fmtDate(c.lastSeen)} />
            )}
          </dl>
        </div>

        {/* Vehicles (guests) or activity (registered) */}
        <div className="card p-5">
          {kind === 'guest' ? (
            <>
              <h2 className="mb-3 text-sm font-semibold">Vehicles Seen</h2>
              {stats.vehicles?.length > 0 ? (
                <div className="space-y-2">
                  {stats.vehicles.map((v: any) => (
                    <div key={v.number} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <Car className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-mono text-sm font-semibold">{v.number}</p>
                        {v.model && <p className="text-xs text-slate-400">{v.model}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No vehicle information recorded.</p>
              )}

              {stats.locations?.length > 0 && (
                <>
                  <h3 className="mt-5 mb-2 text-xs font-semibold text-slate-600 dark:text-slate-400">Spaces Visited</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.locations.map((loc: string) => (
                      <span key={loc} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <MapPin className="h-3 w-3" /> {loc}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h2 className="mb-3 text-sm font-semibold">Account Activity</h2>
              <dl className="space-y-2 text-sm">
                <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Joined"     value={fmtDate(c.createdAt)} />
                <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Last update" value={fmtDate(c.updatedAt)} />
                {stats.bookingsTotal === 0 && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40">
                    This customer hasn't made any bookings yet.
                  </p>
                )}
              </dl>
            </>
          )}
        </div>
      </div>

      {/* ── Bookings ── */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">
            Bookings <span className="text-slate-400">({bookings.length})</span>
          </h2>
          {(upcomingCount > 0 || activeCount > 0) && (
            <div className="flex items-center gap-2 text-[11px]">
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {activeCount} active now
                </span>
              )}
              {upcomingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {upcomingCount} upcoming
                </span>
              )}
            </div>
          )}
        </div>

        {bookings.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No bookings yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>When</th>
                  <th>Space · Slot</th>
                  <th>Vendor</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedBookings.map((b) => {
                  const isMonthly  = b.bookingType === 'MONTHLY';
                  const tense      = getTense(b.startAt, b.endAt);
                  const tenseMeta  = TENSE_META[tense];
                  const showTense  = b.status !== 'CANCELLED';
                  return (
                    <tr key={b.id}>
                      <td className="font-mono text-xs text-slate-500">{b.reference}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isMonthly
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {isMonthly
                            ? <><CalendarRange className="h-2.5 w-2.5" /> Monthly</>
                            : <><Clock className="h-2.5 w-2.5" /> Hourly</>}
                        </span>
                        {b.isDirectBooking ? (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            Walk-in
                          </span>
                        ) : (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <Globe className="h-2.5 w-2.5" /> Online
                          </span>
                        )}
                      </td>
                      <td>
                        {showTense && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tenseMeta.cls}`}>
                            {tenseMeta.label}
                          </span>
                        )}
                      </td>
                      <td className="text-sm">
                        <p className="font-medium">{b.slot?.location?.name ?? '—'}</p>
                        <p className="text-xs text-slate-400">
                          <span className="font-mono">{b.slot?.code}</span>
                          {b.slot?.location?.city && <> · {b.slot.location.city}</>}
                        </p>
                      </td>
                      <td className="text-sm text-slate-500">
                        {b.slot?.location?.vendor?.businessName ?? '—'}
                      </td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(b.startAt)}</td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(b.endAt)}</td>
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
                      {/* Actions */}
                      <td>
                        {(b.isDirectBooking || canCancel(b.status)) ? (
                          <KebabMenu>
                            {b.isDirectBooking && (
                              <MenuItem
                                icon={<Pencil className="h-4 w-4" />}
                                onClick={() => setEditTarget(b)}
                              >
                                Edit Booking
                              </MenuItem>
                            )}
                            {canCancel(b.status) && (
                              <MenuItem
                                variant="danger"
                                icon={<Ban className="h-4 w-4" />}
                                onClick={() => setCancelTarget(b)}
                              >
                                Cancel Booking
                              </MenuItem>
                            )}
                          </KebabMenu>
                        ) : (
                          <span className="inline-block h-8 w-8" />
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

      {/* ── Action modals ── */}
      {cancelTarget && (
        <CancelBookingModal
          booking={cancelTarget}
          onClose={() => !cancel.isPending && setCancelTarget(null)}
          onConfirm={(reason) => cancel.mutate({ id: cancelTarget.id, reason })}
          isPending={cancel.isPending}
        />
      )}
      {editTarget && (
        <EditBookingModal
          booking={editTarget}
          onClose={() => !editBooking.isPending && setEditTarget(null)}
          onSave={(form) => editBooking.mutate({ id: editTarget.id, data: form })}
          isPending={editBooking.isPending}
        />
      )}
    </section>
  );
};

// ── Tiny presentational helpers ──────────────────────────────────────────────
const StatTile = ({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: number | string; sub?: string }) => (
  <div className="card p-4">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
    <div className="mt-1 text-xl font-bold">{value}</div>
    {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
  </div>
);

const DetailRow = ({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}) => {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-32 shrink-0 items-center gap-1.5 text-xs text-slate-400">
        {icon} {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-slate-700 dark:text-slate-200">
        {value}
      </span>
    </div>
  );
};

