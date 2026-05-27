import { z } from 'zod';

export const Role = z.enum(['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'VENDOR', 'CUSTOMER']);
export type Role = z.infer<typeof Role>;

export const UserDTO = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  role: Role,
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});
export type UserDTO = z.infer<typeof UserDTO>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RegisterInput = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).max(72),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LocationDTO = z.object({
  id: z.string(),
  name: z.string(),
  addressLine: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  isActive: z.boolean(),
});
export type LocationDTO = z.infer<typeof LocationDTO>;

export const BookingStatus = z.enum([
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'FAILED',
]);
export type BookingStatus = z.infer<typeof BookingStatus>;

// ─────────────────────────────────────────────────────────────────────────────
// Pricing — single source of truth for hourly / monthly bookings.
// Both backend and frontends import these helpers so we never have two
// implementations of the same math going out of sync.
// ─────────────────────────────────────────────────────────────────────────────

export const BookingType = z.enum(['HOURLY', 'MONTHLY']);
export type BookingType = z.infer<typeof BookingType>;

/** Monthly subscription always covers 30 days from the start date. */
export const MONTHLY_PASS_DAYS = 30;

export interface BookingCalcInput {
  bookingType: BookingType;
  hourlyPrice: number;
  /** Required when bookingType is MONTHLY; ignored otherwise. */
  monthlyPrice?: number | null;
  startAt: Date | string;
  /** Required when bookingType is HOURLY; ignored for MONTHLY (auto +30 days). */
  endAt?: Date | string | null;
}

export interface BookingCalcResult {
  amount: number;
  startAt: Date;
  endAt: Date;
  units: number;          // hours billed (HOURLY) or 1 (MONTHLY)
  unitLabel: string;      // human-readable: "hour(s)" / "month"
  bookingType: BookingType;
}

/**
 * Compute the price + effective date window for a booking.
 *
 * - HOURLY: rounds up to the next full hour (min 1 hour), price = hours × hourlyPrice.
 * - MONTHLY: requires monthlyPrice; endAt is startAt + 30 days regardless of input.
 *
 * Throws if MONTHLY is requested but the slot has no monthlyPrice configured.
 */
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

  // HOURLY
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

/** Format INR currency for display (₹1,234). Frontend convenience helper. */
export const formatINR = (n: number | string | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

