import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Search, Globe, UserCheck, Ban, Pencil, Clock, CalendarRange, Percent, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { KebabMenu, MenuItem } from '@/components/KebabMenu';
import {
  CancelBookingModal, EditBookingModal, type EditBookingForm,
} from '@/components/BookingModals';

// ── Helpers ───────────────────────────────────────────────────────────────────
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const STATUS_CLS: Record<string, string> = {
  CONFIRMED:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING:         'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
  PENDING_PAYMENT: 'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
  CANCELLED:       'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
  COMPLETED:       'bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400',
};

const STATUS_FILTERS = ['ALL', 'CONFIRMED', 'PENDING_PAYMENT', 'CANCELLED', 'COMPLETED'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_LABELS: Record<string, string> = {
  ALL:             'All',
  CONFIRMED:       'Confirmed',
  PENDING_PAYMENT: 'Pending',
  CANCELLED:       'Cancelled',
  COMPLETED:       'Completed',
};

const canCancel = (status: string) => ['CONFIRMED', 'PENDING_PAYMENT'].includes(status);

// A monthly pass is "active" when it's a live booking whose 30-day window covers now.
const isActiveMonthly = (b: any) => {
  if (b.bookingType !== 'MONTHLY') return false;
  if (!['CONFIRMED', 'COMPLETED'].includes(b.status)) return false;
  const now = Date.now();
  return now >= new Date(b.startAt).getTime() && now <= new Date(b.endAt).getTime();
};

const isRevenue = (b: any) => ['CONFIRMED', 'COMPLETED'].includes(b.status);

// ── Summary card ──────────────────────────────────────────────────────────────
const SummaryCard = ({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-2">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
    <div className="mt-2 text-2xl font-bold">{value}</div>
    {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export const BookingsPage = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter]     = useState<'ALL' | 'ONLINE' | 'DIRECT'>('ALL');
  const [planFilter, setPlanFilter]     = useState<'ALL' | 'HOURLY' | 'MONTHLY'>('ALL');
  const [search, setSearch]             = useState('');
  const [cancelBooking, setCancelBooking] = useState<any | null>(null);
  const [editTarget, setEditTarget]     = useState<any | null>(null);
  const [editingRate, setEditingRate]   = useState(false);
  const [rateInput, setRateInput]       = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => (await api.get('/admin/bookings')).data,
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/admin/bookings/${id}/cancel`, { reason: reason || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      setCancelBooking(null);
    },
  });

  const editGuest = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditBookingForm }) => {
      const payload: any = { ...data };
      if (data.bookingType === 'MONTHLY') delete payload.endAt;
      return api.patch(`/admin/bookings/${id}/guest`, payload).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      setEditTarget(null);
    },
    onError: (err: any) => {
      alert(
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        'Failed to save changes. Please try again.',
      );
    },
  });

  // ── Commission ──
  const { data: commissionData } = useQuery({
    queryKey: ['admin-commission-summary'],
    queryFn: async () => (await api.get('/admin/commission/summary')).data,
  });

  const markCommission = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'PAID' | 'PENDING' }) =>
      api.patch(`/admin/bookings/${id}/commission`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      qc.invalidateQueries({ queryKey: ['admin-commission-summary'] });
    },
    onError: (err: any) => {
      alert(
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        'Failed to update commission status. Make sure the backend has been restarted after the database migration.',
      );
    },
  });

  const updateRate = useMutation({
    mutationFn: (rate: number) => api.patch('/admin/settings/commission', { rate }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-commission-summary'] });
      qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      setEditingRate(false);
    },
    onError: (err: any) => {
      alert(
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        'Failed to update commission rate.',
      );
    },
  });

  const allBookings: any[] = data?.items ?? [];

  const filtered = allBookings.filter((b) => {
    const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchType =
      typeFilter === 'ALL' ||
      (typeFilter === 'DIRECT' && b.isDirectBooking) ||
      (typeFilter === 'ONLINE' && !b.isDirectBooking);
    const matchPlan =
      planFilter === 'ALL' ||
      (planFilter === 'MONTHLY' && b.bookingType === 'MONTHLY') ||
      (planFilter === 'HOURLY'  && b.bookingType !== 'MONTHLY');

    const q = search.toLowerCase();
    const customerName = b.isDirectBooking
      ? (b.guestName ?? b.user?.fullName ?? '')
      : (b.user?.fullName ?? '');
    const customerEmail = b.user?.email ?? '';
    const vendorName    = b.slot?.location?.vendor?.businessName ?? '';
    const spaceName     = b.slot?.location?.name ?? '';

    const matchSearch =
      !q ||
      b.reference?.toLowerCase().includes(q) ||
      customerName.toLowerCase().includes(q) ||
      customerEmail.toLowerCase().includes(q) ||
      vendorName.toLowerCase().includes(q) ||
      spaceName.toLowerCase().includes(q);

    return matchStatus && matchType && matchPlan && matchSearch;
  });

  const onlineCount = allBookings.filter((b) => !b.isDirectBooking).length;
  const directCount = allBookings.filter((b) =>  b.isDirectBooking).length;

  // ── Summary stats (computed over ALL bookings, not the current filter) ──
  const monthlyCount    = allBookings.filter((b) => b.bookingType === 'MONTHLY').length;
  const hourlyCount     = allBookings.length - monthlyCount;
  const activeMonthly   = allBookings.filter(isActiveMonthly).length;
  const revenueBookings = allBookings.filter(isRevenue);
  const totalRevenue    = revenueBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
  const monthlyRevenue  = revenueBookings
    .filter((b) => b.bookingType === 'MONTHLY')
    .reduce((sum, b) => sum + Number(b.totalAmount), 0);

  return (
    <>
      <section className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/20">
            <CalendarCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Bookings</h1>
            <p className="text-sm text-slate-500">
              {allBookings.length} total &mdash;{' '}
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3 text-blue-500" /> {onlineCount} online
              </span>
              {' · '}
              <span className="inline-flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-violet-500" /> {directCount} direct
              </span>
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={<CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-300" />}
            accent="bg-blue-100 dark:bg-blue-900/30"
            label="Total Bookings"
            value={allBookings.length}
            sub={`${hourlyCount} hourly · ${monthlyCount} monthly`}
          />
          <SummaryCard
            icon={<CalendarRange className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />}
            accent="bg-indigo-100 dark:bg-indigo-900/30"
            label="Active Monthly Passes"
            value={activeMonthly}
            sub={`${monthlyCount} total monthly`}
          />
          <SummaryCard
            icon={<span className="text-sm font-bold text-emerald-600 dark:text-emerald-300">₹</span>}
            accent="bg-emerald-100 dark:bg-emerald-900/30"
            label="Total Revenue"
            value={inr(totalRevenue)}
            sub="Confirmed + completed"
          />
          <SummaryCard
            icon={<span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">₹</span>}
            accent="bg-indigo-100 dark:bg-indigo-900/30"
            label="Monthly Pass Revenue"
            value={inr(monthlyRevenue)}
            sub={`${((totalRevenue ? monthlyRevenue / totalRevenue : 0) * 100).toFixed(0)}% of revenue`}
          />
        </div>

        {/* Commission panel */}
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm font-semibold">Company Commission</h2>
              {/* Editable rate */}
              {editingRate ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    type="number" min="0" max="100" step="0.5"
                    className="input h-7 w-20 text-sm"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    autoFocus
                  />
                  <span className="text-sm text-slate-500">%</span>
                  <button
                    className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    disabled={updateRate.isPending}
                    onClick={() => updateRate.mutate(Number(rateInput))}
                  >
                    {updateRate.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setEditingRate(false)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {commissionData?.rate ?? '—'}%
                  </span>
                  <button
                    className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline dark:text-amber-400"
                    onClick={() => { setRateInput(String(commissionData?.rate ?? 10)); setEditingRate(true); }}
                  >
                    <Pencil className="h-3 w-3" /> Edit rate
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={<Percent className="h-4 w-4 text-amber-600 dark:text-amber-300" />}
              accent="bg-amber-100 dark:bg-amber-900/30"
              label="Total Commission"
              value={inr(commissionData?.totalCommission ?? 0)}
              sub="On confirmed + completed"
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />}
              accent="bg-emerald-100 dark:bg-emerald-900/30"
              label="Received"
              value={inr(commissionData?.paidCommission ?? 0)}
            />
            <SummaryCard
              icon={<Clock className="h-4 w-4 text-red-600 dark:text-red-300" />}
              accent="bg-red-100 dark:bg-red-900/30"
              label="Pending Collection"
              value={inr(commissionData?.pendingCommission ?? 0)}
            />
          </div>
        </div>

        {/* Filters row */}
        <div className="mt-5 flex flex-wrap gap-3">
          {/* Status tabs */}
          <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === s
                    ? 'bg-white shadow text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Booking type tabs */}
          <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
            {(['ALL', 'ONLINE', 'DIRECT'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  typeFilter === t
                    ? 'bg-white shadow text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t === 'ONLINE' && <Globe className="h-3 w-3" />}
                {t === 'DIRECT' && <UserCheck className="h-3 w-3" />}
                {t === 'ALL' ? 'All Types' : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Plan tabs (hourly / monthly) */}
          <div className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
            {(['ALL', 'HOURLY', 'MONTHLY'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlanFilter(p)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  planFilter === p
                    ? 'bg-white shadow text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {p === 'HOURLY'  && <Clock className="h-3 w-3" />}
                {p === 'MONTHLY' && <CalendarRange className="h-3 w-3" />}
                {p === 'ALL' ? 'All Plans' : p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              className="input w-full pl-8 text-sm"
              placeholder="Search by name, email, space, ref…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              No bookings match this filter.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Plan</th>
                  <th>Ref</th>
                  <th>Customer</th>
                  <th>Vendor</th>
                  <th>Space · Slot</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Duration</th>
                  <th>Amount</th>
                  <th>Commission</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b: any) => {
                  const hrs = Math.max(1, Math.ceil(
                    (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 3_600_000,
                  ));
                  const customerName = b.isDirectBooking && !b.user
                    ? (b.guestName ?? 'Walk-in Guest')
                    : (b.user?.fullName ?? '—');
                  const customerSub = b.isDirectBooking && !b.user
                    ? b.guestPhone ?? b.guestVehicleNumber ?? ''
                    : (b.user?.email ?? '');
                  const vendorName  = b.slot?.location?.vendor?.businessName ?? '—';
                  const vendorEmail = b.slot?.location?.vendor?.user?.email ?? '';

                  return (
                    <tr key={b.id}>
                      {/* Booking type (source) */}
                      <td>
                        {b.isDirectBooking ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                            <UserCheck className="h-3 w-3" /> Direct
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            <Globe className="h-3 w-3" /> Online
                          </span>
                        )}
                      </td>

                      {/* Plan (hourly / monthly) */}
                      <td>
                        {b.bookingType === 'MONTHLY' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            <CalendarRange className="h-3 w-3" /> Monthly
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Clock className="h-3 w-3" /> Hourly
                          </span>
                        )}
                      </td>

                      {/* Reference */}
                      <td>
                        <span className="font-mono text-xs text-slate-500">{b.reference}</span>
                      </td>

                      {/* Customer */}
                      <td>
                        <p className="text-sm font-medium">{customerName}</p>
                        {customerSub && <p className="text-xs text-slate-400">{customerSub}</p>}
                        {b.guestVehicleNumber && b.isDirectBooking && !b.user && b.guestPhone && (
                          <p className="text-xs text-slate-400">{b.guestVehicleNumber}</p>
                        )}
                      </td>

                      {/* Vendor */}
                      <td>
                        <p className="text-sm font-medium">{vendorName}</p>
                        {vendorEmail && <p className="text-xs text-slate-400">{vendorEmail}</p>}
                      </td>

                      {/* Space · Slot */}
                      <td className="text-sm">
                        {b.slot?.location?.name}
                        <span className="ml-1 font-mono text-xs text-slate-400">· {b.slot?.code}</span>
                      </td>

                      <td className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(b.startAt)}</td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(b.endAt)}</td>

                      <td>
                        {b.bookingType === 'MONTHLY' ? (
                          <>
                            <span className="font-semibold">1</span>
                            <span className="text-xs text-slate-400"> month</span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">{hrs}</span>
                            <span className="text-xs text-slate-400"> hr{hrs !== 1 ? 's' : ''}</span>
                          </>
                        )}
                      </td>

                      <td className="font-semibold">{inr(Number(b.totalAmount))}</td>

                      {/* Commission */}
                      <td>
                        {b.status === 'CANCELLED' ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold">{inr(Number(b.commissionAmount ?? 0))}</p>
                            <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              b.commissionStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {b.commissionStatus === 'PAID'
                                ? <><CheckCircle2 className="h-2.5 w-2.5" /> Received</>
                                : <><Clock className="h-2.5 w-2.5" /> Pending</>}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[b.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {b.status === 'PENDING_PAYMENT' ? 'Pending' : b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                        </span>
                        {/* Show cancel reason if available */}
                        {b.status === 'CANCELLED' && b.cancelReason && (
                          <p className="mt-0.5 text-[10px] text-slate-400 max-w-[120px] truncate" title={b.cancelReason}>
                            {b.cancelReason}
                          </p>
                        )}
                      </td>

                      {/* Actions — KebabMenu (portal-based, always above table) */}
                      <td>
                        {(() => {
                          const canMarkCommission = ['CONFIRMED', 'COMPLETED'].includes(b.status);
                          if (!b.isDirectBooking && !canCancel(b.status) && !canMarkCommission) {
                            return <span className="inline-block h-8 w-8" />;
                          }
                          return (
                            <KebabMenu>
                              {b.isDirectBooking && (
                                <MenuItem
                                  icon={<Pencil className="h-4 w-4" />}
                                  onClick={() => setEditTarget(b)}
                                >
                                  Edit Booking
                                </MenuItem>
                              )}
                              {canMarkCommission && (
                                b.commissionStatus === 'PAID' ? (
                                  <MenuItem
                                    icon={<Clock className="h-4 w-4" />}
                                    onClick={() => markCommission.mutate({ id: b.id, status: 'PENDING' })}
                                  >
                                    Mark Commission Pending
                                  </MenuItem>
                                ) : (
                                  <MenuItem
                                    icon={<CheckCircle2 className="h-4 w-4" />}
                                    onClick={() => markCommission.mutate({ id: b.id, status: 'PAID' })}
                                  >
                                    Mark Commission Received
                                  </MenuItem>
                                )
                              )}
                              {canCancel(b.status) && (
                                <MenuItem
                                  variant="danger"
                                  icon={<Ban className="h-4 w-4" />}
                                  onClick={() => setCancelBooking(b)}
                                >
                                  Cancel Booking
                                </MenuItem>
                              )}
                            </KebabMenu>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Cancel confirmation modal */}
      {cancelBooking && (
        <CancelBookingModal
          booking={cancelBooking}
          onClose={() => !cancel.isPending && setCancelBooking(null)}
          onConfirm={(reason) => cancel.mutate({ id: cancelBooking.id, reason })}
          isPending={cancel.isPending}
        />
      )}

      {editTarget && (
        <EditBookingModal
          booking={editTarget}
          onClose={() => !editGuest.isPending && setEditTarget(null)}
          onSave={(data) => editGuest.mutate({ id: editTarget.id, data })}
          isPending={editGuest.isPending}
        />
      )}
    </>
  );
};
