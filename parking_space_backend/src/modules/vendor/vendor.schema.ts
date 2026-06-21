import { z } from 'zod';

// User-level fields that live on the User model (not Vendor)
export const USER_FIELDS = ['fullName', 'phone', 'email'] as const;
export type UserField = typeof USER_FIELDS[number];

export const updateProfileSchema = z.object({
  // Owner / User fields
  fullName:     z.string().min(2).max(120).optional(),
  phone:        z.string().max(20).optional(),
  email:        z.string().email().optional(),
  // Vendor fields
  businessName: z.string().min(2).max(120).optional(),
  contactPhone: z.string().min(7).max(20).optional(),
  address:      z.string().min(3).max(255).optional(),
  gstNumber:    z.string().max(32).optional(),
  panNumber:    z.string().max(16).optional(),
  payoutUpiId:  z.string().max(64).optional(),
  aadharNumber: z.string().max(20).nullish(),
  aadharDocUrl: z.union([z.string().url(), z.literal('')]).nullish(),
}).partial();

export const aadhaarUploadSchema = z.object({
  aadharNumber: z.string().max(20).optional(),
  aadharDocUrl: z.string().url(),
});

export const locationSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  addressLine: z.string().min(3).max(255),
  landmark: z.string().max(160).optional(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().min(3).max(12),
  area: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const slotSchema = z.object({
  code: z.string().min(1).max(32),
  vehicleType: z.string().default('FOUR_WHEELER'),
  hourlyPrice: z.number().nonnegative(),
  dailyPrice: z.number().nonnegative().default(0),   // kept for DB compat; UI no longer collects it
  monthlyPrice: z.number().nonnegative().nullish(),
});

export const slotUpdateSchema = z.object({
  code: z.string().min(1).max(32).optional(),
  vehicleType: z.string().optional(),
  hourlyPrice: z.number().nonnegative().optional(),
  dailyPrice: z.number().nonnegative().optional(),
  monthlyPrice: z.number().nonnegative().nullish(),
});

// Direct / offline booking created by vendor on behalf of a walk-in customer
// Supports HOURLY (custom date range) or MONTHLY (30-day pass from startAt).
export const directBookingSchema = z
  .object({
    slotId: z.string().min(1),
    guestName: z.string().min(2).max(100),
    // Email is the mandatory identity — the booking is linked to the customer
    // account with this email (created if needed) so the walk-in sees it on login.
    guestEmail: z.string().email(),
    guestPhone: z.string().min(7).max(20).optional(),
    guestVehicleNumber: z.string().max(20).optional(),
    guestVehicleModel: z.string().max(80).optional(),
    bookingType: z.enum(['HOURLY', 'MONTHLY']).default('HOURLY'),
    startAt: z.coerce.date(),
    endAt: z.coerce.date().optional(), // required for HOURLY; ignored for MONTHLY
    totalAmount: z.number().positive().optional(), // override; auto-calculated if omitted
  })
  .refine(
    (d) => d.bookingType === 'MONTHLY' || (d.endAt && d.endAt > d.startAt),
    { message: 'endAt must be after startAt for hourly bookings' },
  );

export const editGuestSchema = z.object({
  guestName:          z.string().min(2).max(100).optional(),
  guestPhone:         z.string().min(7).max(20).optional(),
  guestVehicleNumber: z.string().max(20).optional(),
  guestVehicleModel:  z.string().max(80).optional(),
  bookingType:        z.enum(['HOURLY', 'MONTHLY']).optional(),
  startAt:            z.coerce.date().optional(),
  endAt:              z.coerce.date().optional(), // ignored for MONTHLY
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AadhaarUploadInput = z.infer<typeof aadhaarUploadSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type SlotInput = z.infer<typeof slotSchema>;
export type SlotUpdateInput = z.infer<typeof slotUpdateSchema>;
export type DirectBookingInput = z.infer<typeof directBookingSchema>;
export type EditGuestInput = z.infer<typeof editGuestSchema>;
