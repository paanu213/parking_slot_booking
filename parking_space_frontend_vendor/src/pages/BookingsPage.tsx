import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { CheckCircle2, XCircle, User, Ban, X, MoreVertical, Pencil, Plus } from 'lucide-react';
import { api } from '@/lib/api';

interface Slot { id: string; code: string; hourlyPrice: number; }
interface Space { id: string; name: string; slots: Slot[]; }
interface Booking {
  id: string;
  reference: string;
  startAt: string;
  endAt: string;
  totalAmount: number;
  status: string;
  cancelReason?: string | null;
  isDirectBooking?: boolean;
  guestName?: string;
  guestPhone?: string;
  guestVehicleNumber?: string;
  guestVehicleModel?: string;
  user?: { fullName: string; email: string } | null;
  slot?: { code: string; hourlyPrice?: number; location?: { name: string } };
}

interface DirectBookingForm {
  spaceId: string;
  slotId: string;
  guestName: string;
  guestPhone: string;
  guestVehicleNumber?: string;
  guestVehicleModel?: string;
  startAt: string;
  endAt: string;
}

interface EditGuestForm {
  guestName: string;
  guestPhone: string;
  guestVehicleNumber: string;
  guestVehicleModel: string;
  startAt: string;
  endAt: string;
}

const STATUS_CLS: Record<string, string> = {
  CONFIRMED:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  PENDING_PAYMENT: 'bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-300',
  CANCELLED:       'bg-red-100     text-red-600     dark:bg-red-900/30     dark:text-red-400',
  COMPLETED:       'bg-slate-100   text-slate-600   dark:bg-slate-700      dark:text-slate-300',
  FAILED:          'bg-red-100     text-red-600     dark:bg-red-900/30     dark:text-red-400',
};

const fmt = (d: string) =>
  new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/** Convert an ISO date string to the value format expected by <input type="datetime-local"> */
const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const canCancel = (status: string) => ['CONFIRMED', 'PENDING_PAYMENT'].includes(status);

// ── Direct Booking Slide-over Modal ───────────────────────────────────────────
const DirectBookingModal = ({
  spaces,
  onClose,
  onCreated,
}: {
  spaces:    Space[];
  onClose:   () => void;
  onCreated: () => void;
}) => {
  const [formError,   setFormError]   = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const createDirectBooking = useMutation({
    mutationFn: (input: Omit<DirectBookingForm, 'spaceId'>) =>
      api.post('/vendor/direct-bookings', input).then((r) => r.data),
    onSuccess: () => {
      setFormError(null);
      setFormSuccess(true);
      onCreated();
      setTimeout(() => onClose(), 1200);
    },
    onError: (err: any) => {
      setFormError(
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        'Failed to create booking. Please try again.',
      );
    },
  });

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over panel — right side */}
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold">New Direct Booking</h2>
            <p className="text-sm text-slate-500">Walk-in / offline customer</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {formSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Booking created successfully!
            </div>
          )}
          {formError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          {spaces.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-8 text-center dark:border-slate-800 dark:bg-slate-800/40">
              <p className="text-sm text-slate-500">
                You have no approved spaces with active slots yet.
              </p>
            </div>
          ) : (
            <DirectBookingFormFields
              spaces={spaces}
              submitting={createDirectBooking.isPending}
              onSubmit={(values) => {
                const { spaceId: _space, ...rest } = values;
                createDirectBooking.mutate(rest);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Cancel Confirmation Modal ──────────────────────────────────────────────────
const CancelModal = ({
  booking,
  onClose,
  onConfirm,
  isPending,
}: {
  booking:   Booking;
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

  const customerName = booking.isDirectBooking
    ? (booking.guestName ?? 'Walk-in Guest')
    : (booking.user?.fullName ?? '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isPending && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Cancel Booking</h2>
              <p className="text-sm font-mono text-slate-500">{booking.reference}</p>
            </div>
          </div>
          <button
            onClick={() => !isPending && onClose()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
          <div className="grid grid-cols-2 gap-y-1.5">
            <span className="text-slate-400">Customer</span>
            <span className="font-medium text-right">{customerName}</span>
            <span className="text-slate-400">Space</span>
            <span className="font-medium text-right">{booking.slot?.location?.name ?? '—'}</span>
            <span className="text-slate-400">Slot</span>
            <span className="font-medium font-mono text-right">{booking.slot?.code ?? '—'}</span>
            <span className="text-slate-400">Amount</span>
            <span className="font-semibold text-right">₹{Number(booking.totalAmount).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-medium">
            Cancellation Reason <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            className="input w-full text-sm"
            rows={2}
            placeholder="e.g. Customer requested cancellation, no-show, etc."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
          ⚠️ This action cannot be undone. The booking will be permanently marked as cancelled.
        </p>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={isPending} className="btn-ghost flex-1">
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

// ── Edit Guest Info Modal ──────────────────────────────────────────────────────
const EditGuestModal = ({
  booking,
  onClose,
  onSave,
  isPending,
}: {
  booking:   Booking;
  onClose:   () => void;
  onSave:    (data: EditGuestForm) => void;
  isPending: boolean;
}) => {
  const { register, handleSubmit, watch } = useForm<EditGuestForm>({
    defaultValues: {
      guestName:          booking.guestName          ?? '',
      guestPhone:         booking.guestPhone         ?? '',
      guestVehicleNumber: booking.guestVehicleNumber ?? '',
      guestVehicleModel:  booking.guestVehicleModel  ?? '',
      startAt:            toDatetimeLocal(booking.startAt),
      endAt:              toDatetimeLocal(booking.endAt),
    },
  });

  const startAt = watch('startAt');
  const endAt   = watch('endAt');

  // Live amount preview
  const hourlyRate = (booking as any).slot?.hourlyPrice ?? null;
  const liveAmount = (() => {
    if (!startAt || !endAt || !hourlyRate) return null;
    const s = new Date(startAt).getTime();
    const e = new Date(endAt).getTime();
    if (e <= s) return null;
    const hours = Math.max(1, Math.ceil((e - s) / 3_600_000));
    return { hours, amount: Number(hourlyRate) * hours };
  })();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isPending) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, isPending]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isPending && onClose()} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
              <Pencil className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Edit Booking</h2>
              <p className="text-sm font-mono text-slate-500">{booking.reference}</p>
            </div>
          </div>
          <button
            onClick={() => !isPending && onClose()}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="grid gap-3">

          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Customer Name *</label>
              <input className="input w-full" placeholder="Full name" required {...register('guestName')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Customer Phone *</label>
              <input className="input w-full" placeholder="Phone number" required {...register('guestPhone')} />
            </div>
          </div>

          {/* Vehicle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Vehicle Number</label>
              <input className="input w-full" placeholder="e.g. TS09AB1234" {...register('guestVehicleNumber')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Vehicle Name / Model</label>
              <input className="input w-full" placeholder="e.g. Honda City" {...register('guestVehicleModel')} />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Booking Window</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Start Date & Time *</label>
              <input className="input w-full" type="datetime-local" required {...register('startAt')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">End Date & Time *</label>
              <input className="input w-full" type="datetime-local" required {...register('endAt')} />
            </div>
          </div>

          {/* Live amount preview */}
          {liveAmount ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">
                  {liveAmount.hours} hr{liveAmount.hours !== 1 ? 's' : ''}
                  {hourlyRate ? ` × ₹${Number(hourlyRate).toLocaleString('en-IN')}/hr` : ''}
                </span>
                <span className="text-lg font-bold">₹{liveAmount.amount.toLocaleString('en-IN')}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Total amount will be recalculated automatically.</p>
            </div>
          ) : (
            startAt && endAt && new Date(endAt) <= new Date(startAt) && (
              <p className="text-xs text-red-500">End time must be after start time.</p>
            )
          )}

          {/* Actions */}
          <div className="mt-1 flex gap-3">
            <button type="button" onClick={onClose} disabled={isPending} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Row Action Menu (3-dot) ───────────────────────────────────────────────────
const RowMenu = ({
  booking,
  onCancel,
  onEditGuest,
}: {
  booking:     Booking;
  onCancel:    () => void;
  onEditGuest: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const cancellable = canCancel(booking.status);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        title="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 origin-top-right rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {booking.isDirectBooking && (
            <button
              type="button"
              onClick={() => { setOpen(false); onEditGuest(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              Edit Guest Info
            </button>
          )}
          <button
            type="button"
            disabled={!cancellable}
            onClick={() => { setOpen(false); onCancel(); }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
              cancellable
                ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                : 'cursor-not-allowed text-slate-300 dark:text-slate-600'
            }`}
          >
            <Ban className="h-3.5 w-3.5 shrink-0" />
            Cancel Booking
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const BookingsPage = () => {
  const qc = useQueryClient();
  const [showDirectBooking, setShowDirectBooking] = useState(false);
  const [cancelTarget,      setCancelTarget]      = useState<Booking | null>(null);
  const [editTarget,        setEditTarget]        = useState<Booking | null>(null);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['vendor-bookings'],
    queryFn: async () => (await api.get('/vendor/bookings')).data,
  });

  const { data: spacesData } = useQuery({
    queryKey: ['vendor-spaces'],
    queryFn: async () => (await api.get<{ items: Space[] }>('/vendor/locations')).data,
  });

  const cancelBooking = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/vendor/bookings/${id}/cancel`, { reason: reason || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-bookings'] });
      setCancelTarget(null);
    },
  });

  const editGuest = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditGuestForm }) =>
      api.patch(`/vendor/bookings/${id}/guest`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-bookings'] });
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

  const approvedSpaces: Space[] = (spacesData?.items ?? []).filter(
    (s: any) => s.approvalStatus === 'APPROVED',
  );

  const bookings: Booking[] = bookingsData?.items ?? [];

  return (
    <>
      <section className="p-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Bookings</h1>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowDirectBooking(true)}
          >
            <Plus className="h-4 w-4" />
            Direct Booking
          </button>
        </div>

        {/* Bookings table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-5 w-full" />
              <div className="skeleton h-5 w-2/3" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <User className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No bookings yet.</p>
              <button
                className="btn-primary flex items-center gap-2 text-sm"
                onClick={() => setShowDirectBooking(true)}
              >
                <Plus className="h-4 w-4" /> Add a walk-in booking
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Vehicle</th>
                    <th className="px-3 py-2">Space / Slot</th>
                    <th className="px-3 py-2">Window</th>
                    <th className="px-3 py-2">Hrs</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const customerName = b.isDirectBooking ? b.guestName : b.user?.fullName ?? '—';
                    const customerSub  = b.isDirectBooking ? b.guestPhone : b.user?.email;
                    const hours = Math.max(1, Math.ceil(
                      (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 3_600_000,
                    ));

                    return (
                      <tr
                        key={b.id}
                        className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                      >
                        {/* Reference */}
                        <td className="px-3 py-2">
                          <div className="font-mono text-xs">{b.reference}</div>
                          {b.isDirectBooking && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                              <User className="h-3 w-3" /> Walk-in
                            </span>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="px-3 py-2">
                          <div className="font-medium">{customerName}</div>
                          {customerSub && (
                            <div className="text-xs text-slate-400">{customerSub}</div>
                          )}
                        </td>

                        {/* Vehicle */}
                        <td className="px-3 py-2">
                          {b.isDirectBooking ? (
                            <>
                              {b.guestVehicleNumber ? (
                                <div className="font-mono text-xs font-medium">
                                  {b.guestVehicleNumber}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-300 dark:text-slate-600">—</div>
                              )}
                              {b.guestVehicleModel && (
                                <div className="text-xs text-slate-400">{b.guestVehicleModel}</div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>

                        {/* Space / Slot */}
                        <td className="px-3 py-2">
                          <div>{b.slot?.location?.name}</div>
                          <div className="text-xs text-slate-400">Slot {b.slot?.code}</div>
                        </td>

                        {/* Time window */}
                        <td className="px-3 py-2 text-xs">
                          <div>{fmt(b.startAt)}</div>
                          <div className="text-slate-400">→ {fmt(b.endAt)}</div>
                        </td>

                        {/* Hours */}
                        <td className="px-3 py-2">
                          <span className="font-semibold">{hours}</span>
                          <span className="text-xs text-slate-400"> hr{hours !== 1 ? 's' : ''}</span>
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-2 font-medium">
                          ₹{Number(b.totalAmount).toLocaleString('en-IN')}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[b.status] ?? 'bg-slate-100 text-slate-600'}`}
                          >
                            {b.status.replace('_', ' ')}
                          </span>
                          {b.status === 'CANCELLED' && b.cancelReason && (
                            <p
                              className="mt-0.5 text-[10px] text-slate-400 max-w-[100px] truncate"
                              title={b.cancelReason}
                            >
                              {b.cancelReason}
                            </p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          <RowMenu
                            booking={b}
                            onCancel={() => setCancelTarget(b)}
                            onEditGuest={() => setEditTarget(b)}
                          />
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

      {/* Direct Booking slide-over */}
      {showDirectBooking && (
        <DirectBookingModal
          spaces={approvedSpaces}
          onClose={() => setShowDirectBooking(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['vendor-bookings'] })}
        />
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          onClose={() => !cancelBooking.isPending && setCancelTarget(null)}
          onConfirm={(reason) => cancelBooking.mutate({ id: cancelTarget.id, reason })}
          isPending={cancelBooking.isPending}
        />
      )}

      {/* Edit guest info modal */}
      {editTarget && (
        <EditGuestModal
          booking={editTarget}
          onClose={() => !editGuest.isPending && setEditTarget(null)}
          onSave={(data) => editGuest.mutate({ id: editTarget.id, data })}
          isPending={editGuest.isPending}
        />
      )}
    </>
  );
};

// ── Direct Booking Form Fields ─────────────────────────────────────────────────
const DirectBookingFormFields = ({
  spaces,
  submitting,
  onSubmit,
}: {
  spaces:     Space[];
  submitting: boolean;
  onSubmit:   (v: DirectBookingForm) => void;
}) => {
  const { register, handleSubmit, watch, setValue, reset } = useForm<DirectBookingForm>();
  const selectedSpaceId = watch('spaceId');
  const selectedSlotId  = watch('slotId');
  const startAt         = watch('startAt');
  const endAt           = watch('endAt');

  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId);
  const activeSlots   = selectedSpace?.slots.filter((s: any) => s.status === 'ACTIVE') ?? [];
  const selectedSlot  = activeSlots.find((s) => s.id === selectedSlotId);

  useEffect(() => { setValue('slotId', ''); }, [selectedSpaceId, setValue]);

  return (
    <form
      onSubmit={handleSubmit((v) => { onSubmit(v); reset(); })}
      className="grid gap-4"
    >
      {/* Space & Slot */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Space *</label>
          <select className="input w-full" required {...register('spaceId')}>
            <option value="">Select a space…</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Slot *</label>
          <select className="input w-full" required disabled={!selectedSpaceId} {...register('slotId')}>
            <option value="">Select a slot…</option>
            {activeSlots.map((s) => (
              <option key={s.id} value={s.id}>{s.code} — ₹{s.hourlyPrice}/hr</option>
            ))}
          </select>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Customer Details</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Customer Name & Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Customer Name *</label>
          <input className="input w-full" placeholder="Full name" required {...register('guestName')} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Customer Phone *</label>
          <input className="input w-full" placeholder="Phone number" required {...register('guestPhone')} />
        </div>
      </div>

      {/* Vehicle */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Vehicle Number</label>
          <input className="input w-full" placeholder="e.g. TS09AB1234" {...register('guestVehicleNumber')} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Vehicle Name / Model</label>
          <input className="input w-full" placeholder="e.g. Honda City" {...register('guestVehicleModel')} />
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Booking Window</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Start & End */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Start *</label>
          <input className="input w-full" type="datetime-local" required {...register('startAt')} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">End *</label>
          <input className="input w-full" type="datetime-local" required {...register('endAt')} />
        </div>
      </div>

      {/* Live amount preview */}
      {selectedSlot && startAt && endAt && (() => {
        const start = new Date(startAt).getTime();
        const end   = new Date(endAt).getTime();
        if (end <= start) return null;
        const hours  = Math.max(1, Math.ceil((end - start) / 3_600_000));
        const amount = Number(selectedSlot.hourlyPrice) * hours;
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                {hours} hr{hours !== 1 ? 's' : ''} × ₹{Number(selectedSlot.hourlyPrice).toLocaleString('en-IN')}/hr
              </span>
              <span className="text-xl font-bold">₹{amount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        );
      })()}

      <button className="btn-primary w-full py-3" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create Booking'}
      </button>
    </form>
  );
};
