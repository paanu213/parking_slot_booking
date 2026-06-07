/**
 * Shared booking action modals — used by the admin Bookings page and the
 * Customer Details page so cancel / edit behaviour stays identical everywhere.
 *
 *  - CancelBookingModal — confirm + optional reason, calls onConfirm(reason)
 *  - EditBookingModal    — edit guest info, dates, and booking type (direct bookings);
 *                          recalculates amount via the shared pricing calculator.
 */

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Ban, X, Pencil, Clock, CalendarRange } from 'lucide-react';
import {
  calculateBookingAmount, formatINR, MONTHLY_PASS_DAYS, type BookingType,
} from '@/lib/pricing';

// ── Date input helpers ────────────────────────────────────────────────────────
const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toDateOnly = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ── Cancel Booking Modal ────────────────────────────────────────────────────
export const CancelBookingModal = ({
  booking, onClose, onConfirm, isPending,
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
            <span className="font-semibold text-right">{formatINR(Number(booking.totalAmount))}</span>
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

// ── Edit Booking Modal ──────────────────────────────────────────────────────
export interface EditBookingForm {
  guestName: string;
  guestPhone: string;
  guestVehicleNumber: string;
  guestVehicleModel: string;
  bookingType: BookingType;
  startAt: string;
  endAt?: string;
}

export const EditBookingModal = ({
  booking, onClose, onSave, isPending,
}: {
  booking:   any;
  onClose:   () => void;
  onSave:    (data: EditBookingForm) => void;
  isPending: boolean;
}) => {
  const initialType: BookingType = (booking.bookingType ?? 'HOURLY') as BookingType;
  const { register, handleSubmit, watch, setValue } = useForm<EditBookingForm>({
    defaultValues: {
      guestName:          booking.guestName          ?? '',
      guestPhone:         booking.guestPhone         ?? '',
      guestVehicleNumber: booking.guestVehicleNumber ?? '',
      guestVehicleModel:  booking.guestVehicleModel  ?? '',
      bookingType:        initialType,
      startAt:            initialType === 'MONTHLY' ? toDateOnly(booking.startAt) : toDatetimeLocal(booking.startAt),
      endAt:              toDatetimeLocal(booking.endAt),
    },
  });

  const bookingType = watch('bookingType') ?? 'HOURLY';
  const startAt     = watch('startAt');
  const endAt       = watch('endAt');

  const hourlyRate  = booking.slot?.hourlyPrice ?? null;
  const monthlyRate = booking.slot?.monthlyPrice ?? null;
  const monthlyAvailable = !!(monthlyRate && Number(monthlyRate) > 0);

  useEffect(() => {
    if (bookingType === 'MONTHLY' && !monthlyAvailable) {
      setValue('bookingType', 'HOURLY');
    }
  }, [bookingType, monthlyAvailable, setValue]);

  // Convert start input when type changes (datetime-local ↔ date)
  const lastTypeRef = useRef<BookingType>(initialType);
  useEffect(() => {
    if (bookingType === lastTypeRef.current) return;
    if (startAt) {
      if (bookingType === 'MONTHLY') {
        setValue('startAt', startAt.slice(0, 10));
      } else if (startAt.length === 10) {
        setValue('startAt', `${startAt}T00:00`);
      }
    }
    lastTypeRef.current = bookingType;
  }, [bookingType, startAt, setValue]);

  // Live amount preview using the shared calculator
  let preview: ReturnType<typeof calculateBookingAmount> | null = null;
  if (startAt && hourlyRate != null) {
    try {
      preview = calculateBookingAmount({
        bookingType,
        hourlyPrice:  Number(hourlyRate),
        monthlyPrice: monthlyRate ?? null,
        startAt,
        endAt: bookingType === 'HOURLY' ? endAt : null,
      });
    } catch { preview = null; }
  }

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
              <input className="input w-full" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" required
                     {...register('guestPhone', { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); } })} />
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
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Booking Type & {bookingType === 'MONTHLY' ? 'Start Date' : 'Window'}
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Booking type toggle */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Booking Type *</label>
            <div className="inline-flex w-full gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setValue('bookingType', 'HOURLY')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  bookingType === 'HOURLY'
                    ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Hourly
              </button>
              <button
                type="button"
                disabled={!monthlyAvailable}
                onClick={() => monthlyAvailable && setValue('bookingType', 'MONTHLY')}
                title={monthlyAvailable ? 'Monthly 30-day pass' : 'Monthly pricing not configured for this slot'}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  bookingType === 'MONTHLY'
                    ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500'
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Monthly Pass (30 days)
              </button>
            </div>
            {!monthlyAvailable && (
              <p className="mt-1 text-[10px] text-slate-400">
                Monthly subscription not configured for this slot.
              </p>
            )}
          </div>

          {/* Dates */}
          {bookingType === 'MONTHLY' ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Pass Start Date *</label>
              <input className="input w-full" type="date" required {...register('startAt')} />
              {preview && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Pass valid until{' '}
                  <span className="font-medium">
                    {preview.endAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span> ({MONTHLY_PASS_DAYS} days)
                </p>
              )}
            </div>
          ) : (
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
          )}

          {/* Live amount preview */}
          {preview ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">
                  {preview.bookingType === 'MONTHLY'
                    ? `1 month pass (${MONTHLY_PASS_DAYS} days)`
                    : `${preview.units} ${preview.unitLabel}${hourlyRate ? ` × ${formatINR(Number(hourlyRate))}/hr` : ''}`}
                </span>
                <span className="text-lg font-bold">{formatINR(preview.amount)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Total amount will be recalculated automatically.</p>
            </div>
          ) : (
            bookingType === 'HOURLY' && startAt && endAt && new Date(endAt) <= new Date(startAt) && (
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
              disabled={isPending || !preview}
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
