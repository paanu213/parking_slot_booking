/**
 * Backend pricing calculator.
 *
 * KEEP IN SYNC with `packages/types/src/index.ts` → calculateBookingAmount.
 * The two implementations are intentional copies (backend can't easily import
 * the workspace package at runtime) — same formula, same behavior.
 */

export type BookingType = 'HOURLY' | 'MONTHLY';

/** Monthly subscription always covers 30 days from the start date. */
export const MONTHLY_PASS_DAYS = 30;

export interface BookingCalcInput {
  bookingType: BookingType;
  hourlyPrice: number;
  /** Required when bookingType is MONTHLY; ignored otherwise. */
  monthlyPrice?: number | null;
  startAt: Date | string;
  /** Required for HOURLY; ignored for MONTHLY (auto +30 days). */
  endAt?: Date | string | null;
}

export interface BookingCalcResult {
  amount: number;
  startAt: Date;
  endAt: Date;
  units: number;          // hours billed (HOURLY) or 1 (MONTHLY)
  unitLabel: string;
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
    return {
      amount:      monthly,
      startAt,
      endAt,
      units:       1,
      unitLabel:   'month',
      bookingType: 'MONTHLY',
    };
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
