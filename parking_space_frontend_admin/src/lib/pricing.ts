/**
 * Frontend pricing calculator — single source of truth for the admin UI.
 *
 * KEEP IN SYNC with backend `src/lib/pricing.ts` and `@ps/types`. Same formula.
 */

export type BookingType = 'HOURLY' | 'MONTHLY';

export const MONTHLY_PASS_DAYS = 30;

export interface BookingCalcInput {
  bookingType: BookingType;
  hourlyPrice: number;
  monthlyPrice?: number | null;
  startAt: Date | string;
  endAt?: Date | string | null;
}

export interface BookingCalcResult {
  amount:      number;
  startAt:     Date;
  endAt:       Date;
  units:       number;
  unitLabel:   string;
  bookingType: BookingType;
}

export const calculateBookingAmount = (input: BookingCalcInput): BookingCalcResult => {
  const startAt = new Date(input.startAt);

  if (input.bookingType === 'MONTHLY') {
    const monthly = Number(input.monthlyPrice ?? 0);
    if (!Number.isFinite(monthly) || monthly <= 0) {
      throw new Error('Monthly subscription is not available for this slot');
    }
    const endAt = new Date(startAt.getTime() + MONTHLY_PASS_DAYS * 24 * 60 * 60 * 1000);
    return { amount: monthly, startAt, endAt, units: 1, unitLabel: 'month', bookingType: 'MONTHLY' };
  }

  const endAt = input.endAt ? new Date(input.endAt) : new Date(startAt);
  const ms    = Math.max(0, +endAt - +startAt);
  const hours = Math.max(1, Math.ceil(ms / 3_600_000));
  const hourly = Number(input.hourlyPrice ?? 0);
  return {
    amount:      hourly * hours,
    startAt,
    endAt,
    units:       hours,
    unitLabel:   hours === 1 ? 'hour' : 'hours',
    bookingType: 'HOURLY',
  };
};

export const formatINR = (n: number | string | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
