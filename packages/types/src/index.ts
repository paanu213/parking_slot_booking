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
  district: z.string().nullish(),
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

// ── QR Calling ────────────────────────────────────────────────────────────────
// Data contracts for the scan-to-call feature (common QR · full-plate lookup ·
// click-to-call masking · opt-in emergency ICE card). See the QR Calling Blueprint.

/** Indian number plate → normalized uppercase, no spaces/dashes. */
export const normalizePlate = (raw: string) =>
  String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const plateField = z.string().trim().min(6).max(16)
  .transform(normalizePlate)
  .refine((p) => /^[A-Z0-9]{6,12}$/.test(p), 'Enter a valid car number');

const phoneField = z.string().trim().min(8).max(20)
  .refine((p) => /^\+?[0-9]{8,15}$/.test(p.replace(/[\s-]/g, '')), 'Enter a valid phone number');

export const EmergencyContactInput = z.object({
  name:       z.string().trim().min(1).max(80),
  relation:   z.string().trim().max(40).optional(),
  phone:      phoneField,
  showPublic: z.boolean().default(true),
});
export type EmergencyContactInput = z.infer<typeof EmergencyContactInput>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm').optional();

/** Owner registers / edits a car for QR calling. */
export const RegisterVehicleInput = z.object({
  plateNumber:     plateField,
  contactPhone:    phoneField,
  ownerName:       z.string().trim().max(80).optional(),
  silentFrom:      hhmm,
  silentTo:        hhmm,
  dailyReceiveCap: z.number().int().min(1).max(100).optional(),
  // ICE — all opt-in
  emergencyPublic:  z.boolean().default(false),
  bloodGroup:       z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  medicalNotes:     z.string().trim().max(500).optional(),
  emergencyContacts: z.array(EmergencyContactInput).max(5).optional(),
});
export type RegisterVehicleInput = z.infer<typeof RegisterVehicleInput>;

/**
 * Public: scanner submits the full car number.
 * `botToken` is a honeypot: a hidden field real users never fill in, so any
 * non-empty value here marks the submission as bot traffic server-side.
 */
export const LookupInput = z.object({
  plate:    plateField,
  botToken: z.string().optional(),
});
export type LookupInput = z.infer<typeof LookupInput>;

/**
 * Public: scanner enters their own number to be bridged.
 * `idempotencyKey` is client-generated (once per tap of "Call") so a
 * double-tap or an automatic retry resolves to the same CallSession instead
 * of placing two calls.
 */
export const InitiateCallInput = z.object({
  permit:         z.string().min(1),
  callerNumber:   phoneField,
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
});
export type InitiateCallInput = z.infer<typeof InitiateCallInput>;

/** OTP verification of the owner's contact number. */
export const VerifyContactInput = z.object({ otp: z.string().trim().min(4).max(8) });
export type VerifyContactInput = z.infer<typeof VerifyContactInput>;

export const CallStatus = z.enum([
  'INITIATED','RINGING_CALLER','CALLER_ANSWERED','RINGING_OWNER','BRIDGED',
  'COMPLETED','NO_ANSWER','BUSY','OWNER_REJECTED','FAILED','BLOCKED','CANCELLED',
]);
export type CallStatus = z.infer<typeof CallStatus>;

/** Public lookup response — never contains a phone number or owner identity. */
export interface LookupResult {
  found: boolean;
  confirm?: string;        // plate echoed back, e.g. "AP16HJ7956"
  hasEmergency?: boolean;  // is an ICE card available?
  permit?: string;         // short-lived token to place a call / fetch ICE
}

/** The ICE card revealed only after a correct plate + owner opt-in. */
export interface EmergencyCard {
  ownerName?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  contacts: { name: string; relation?: string; phone: string }[];
}

