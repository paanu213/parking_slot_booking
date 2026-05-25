import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Search, Globe, UserCheck, Ban, X } from 'lucide-react';
import { api } from '@/lib/api';
import { KebabMenu, MenuItem } from '@/components/KebabMenu';

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

// ── Cancel Confirmation Modal ──────────────────────────────────────────────────
const CancelModal = ({
  booking,
  onClose,
  onConfirm,
  isPending,
}: {
  booking:   any;
  onClose:   () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isPending) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, isPending]);

  const customerName = booking.isDirectBooking && !booking.user
    ? (booking.guestName ?? 'Walk-in Guest')
    : (booking.user?.fullName ?? '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isPending && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Cancel Booking</h2>
              <p className="text-sm text-slate-500 font-mono">{booking.reference}</p>
            </div>
          </div>
          <button
            onClick={() => !isPending && onClose()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Booking summary */}
        <div className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
          <div className="grid grid-cols-2 gap-y-1.5">
            <span className="text-slate-400">Customer</span>
            <span className="font-medium text-right">{customerName}</span>
            <span className="text-slate-400">Space</span>
            <span className="font-medium text-right">{booking.slot?.location?.name ?? '—'}</span>
            <span className="text-slate-400">Slot</span>
            <span className="font-medium text-right font-mono">{booking.slot?.code ?? '—'}</span>
            <span className="text-slate-400">Amount</span>
            <span className="font-semibold text-right">{inr(Number(booking.totalAmount))}</span>
          </div>
        </div>

        {/* Reason */}
        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium">
            Cancellation Reason <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            className="input w-full text-sm"
            rows={2}
            placeholder="e.g. Customer requested cancellation, double-booking, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
          ⚠️ This action cannot be undone. The booking will be permanently marked as cancelled.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-ghost flex-1"
          >
            Keep Booking
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm(reason.trim())}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Cancelling…' : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const BookingsPage = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter]     = useState<'ALL' | 'ONLINE' | 'DIRECT'>('ALL');
  const [search, setSearch]             = useState('');
  const [cancelBooking, setCancelBooking] = useState<any | null>(null);

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

  const allBookings: any[] = data?.items ?? [];

  const filtered = allBookings.filter((b) => {
    const matchStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchType =
      typeFilter === 'ALL' ||
      (typeFilter === 'DIRECT' && b.isDirectBooking) ||
      (typeFilter === 'ONLINE' && !b.isDirectBooking);

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

    return matchStatus && matchType && matchSearch;
  });

  const onlineCount = allBookings.filter((b) => !b.isDirectBooking).length;
  const directCount = allBookings.filter((b) =>  b.isDirectBooking).length;

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
                  <th>Ref</th>
                  <th>Customer</th>
                  <th>Vendor</th>
                  <th>Space · Slot</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Hrs</th>
                  <th>Amount</th>
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
                      {/* Booking type */}
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
                        <span className="font-semibold">{hrs}</span>
                        <span className="text-xs text-slate-400"> hr{hrs !== 1 ? 's' : ''}</span>
                      </td>

                      <td className="font-semibold">{inr(Number(b.totalAmount))}</td>

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
                        {canCancel(b.status) ? (
                          <KebabMenu>
                            <MenuItem
                              variant="danger"
                              icon={<Ban className="h-4 w-4" />}
                              onClick={() => setCancelBooking(b)}
                            >
                              Cancel Booking
                            </MenuItem>
                          </KebabMenu>
                        ) : (
                          /* Empty cell placeholder keeps column width consistent */
                          <span className="inline-block h-8 w-8" />
                        )}
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
        <CancelModal
          booking={cancelBooking}
          onClose={() => !cancel.isPending && setCancelBooking(null)}
          onConfirm={(reason) => cancel.mutate({ id: cancelBooking.id, reason })}
          isPending={cancel.isPending}
        />
      )}
    </>
  );
};
