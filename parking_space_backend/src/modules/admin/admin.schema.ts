import { z } from 'zod';
import { RegisterVehicleInput } from '@ps/types';
import { CALL_LIMIT_DEFS, type CallLimitName } from '../../lib/callLimits.js';
import { updateVehicleSchema } from '../vehicles/vehicles.schema.js';

export const updateVendorSchema = z.object({
  // Vendor-level fields
  businessName: z.string().min(2).optional(),
  contactPhone: z.string().min(7).optional(),
  address:      z.string().min(3).optional(),
  aadharNumber: z.string().max(20).optional(),
  aadharDocUrl: z.string().url().optional(),
  // Owner / User-level fields
  fullName:     z.string().min(2).optional(),
  phone:        z.string().optional(),
  email:        z.string().email().optional(),
});

export const vendorLeadStatusSchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']) });

export const createVendorSchema = z.object({
  email:        z.string().email(),
  fullName:     z.string().min(2),
  phone:        z.string().optional(),
  businessName: z.string().min(2),
  contactPhone: z.string().min(7),
  address:      z.string().min(3),
  aadharNumber: z.string().max(20).optional(),
  aadharDocUrl: z.string().url().optional(),
  tempPassword: z.string().min(8),
});

export const updateSpaceSchema = z.object({
  name:        z.string().min(2).optional(),
  description: z.string().optional(),
  addressLine: z.string().min(3).optional(),
  landmark:    z.string().trim().max(160).nullish(),
  district:    z.string().trim().max(80).nullish(),
  area:        z.string().trim().max(100).nullish(),
  city:        z.string().trim().min(2).optional(),
  state:       z.string().trim().min(2).optional(),
  pincode:     z.string().trim().length(6).optional(),
  latitude:    z.coerce.number().optional(),
  longitude:   z.coerce.number().optional(),
});

export const createLocationSchema = z.object({
  vendorId:    z.string().min(1),
  name:        z.string().min(2),
  addressLine: z.string().min(3),
  landmark:    z.string().trim().max(160).optional(),
  district:    z.string().trim().max(80).optional(),
  city:        z.string().trim().min(2),
  state:       z.string().trim().min(2),
  pincode:     z.string().trim().length(6),
  area:        z.string().trim().max(100).optional(),
  latitude:    z.coerce.number(),
  longitude:   z.coerce.number(),
  description: z.string().optional(),
});

export const adminSlotSchema = z.object({
  code:         z.string().min(1),
  vehicleType:  z.enum(['TWO_WHEELER', 'FOUR_WHEELER', 'HEAVY']),
  hourlyPrice:  z.coerce.number().min(0),
  monthlyPrice: z.coerce.number().min(0).optional(),
});

export const updateSlotSchema = z.object({
  code:         z.string().min(1).optional(),
  hourlyPrice:  z.coerce.number().positive().optional(),
  monthlyPrice: z.coerce.number().min(0).nullable().optional(), // null clears subscription
  vehicleType:  z.enum(['TWO_WHEELER', 'FOUR_WHEELER', 'HEAVY']).optional(),
});

export const refundSchema = z.object({
  amount: z.coerce.number().positive(),
  note:   z.string().optional(),
});

export const adminEditGuestSchema = z.object({
  guestName:          z.string().min(2).max(100).optional(),
  guestPhone:         z.string().min(7).max(20).optional(),
  guestVehicleNumber: z.string().max(20).optional(),
  guestVehicleModel:  z.string().max(80).optional(),
  bookingType:        z.enum(['HOURLY', 'MONTHLY']).optional(),
  startAt:            z.coerce.date().optional(),
  endAt:              z.coerce.date().optional(), // ignored for MONTHLY
});

export const updateRegisteredCustomerSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  email:    z.string().email().optional(),
  phone:    z.string().min(7).max(20).nullable().optional(),
});

export const updateGuestCustomerSchema = z.object({
  /** Current phone — used to identify the guest's booking set */
  currentPhone:       z.string().min(7).max(20),
  guestName:          z.string().min(1).max(100).optional(),
  guestPhone:         z.string().min(7).max(20).optional(),
  guestVehicleNumber: z.string().max(20).nullable().optional(),
  guestVehicleModel:  z.string().max(80).nullable().optional(),
});

export const createAdminSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'SUB_ADMIN']),
});

export const commissionRateSchema = z.object({ rate: z.coerce.number().min(0).max(100) });

export const commissionStatusSchema = z.object({ status: z.enum(['PAID', 'PENDING']) });

// ── QR Calling (admin) ──────────────────────────────────────────────────────

/** Dispute resolution — reassign a plate's registration to its real owner. */
export const reassignVehicleSchema = z.object({
  ownerEmail: z.string().email(),
  note:       z.string().trim().max(300).optional(),
});

/** Platform-wide setting — not per-vehicle, customers never see or set this. */
export const callDailyCapSchema = z.object({
  dailyCap: z.coerce.number().int().min(1).max(500),
});

/** Every masked-call limit (lib/callLimits.ts) — any subset can be sent; each is bounds-checked. */
export const callLimitsSchema = z.object(
  Object.fromEntries(
    (Object.keys(CALL_LIMIT_DEFS) as CallLimitName[]).map((name) => [
      name,
      z.coerce.number().int().min(CALL_LIMIT_DEFS[name].min).max(CALL_LIMIT_DEFS[name].max).optional(),
    ]),
  ) as Record<CallLimitName, z.ZodOptional<z.ZodNumber>>,
);

export const blockCallGloballySchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

/**
 * Per-vehicle QR validity end date — null clears it back to lifetime.
 * z.null() MUST be tried before z.coerce.date(): `new Date(null)` coerces to
 * the epoch (1970-01-01) instead of failing, so the reverse order would
 * silently turn "clear to lifetime" into "expired since 1970".
 */
export const setVehicleValiditySchema = z.object({
  validUntil: z.union([z.null(), z.coerce.date()]),
});

export const setQrOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED']),
  note:   z.string().trim().max(300).optional(),
});

/** Admin records which physical sticker (by its printed token) went into the package at dispatch. */
export const qrOrderReplacementSchema = z.object({
  reason: z.string().trim().min(2, 'Add a short reason').max(300),
});
export type QrOrderReplacementInput = z.infer<typeof qrOrderReplacementSchema>;

export const dispatchStickerSchema = z.object({
  token: z.string().trim().min(4).max(40),
});

/** Admin pause/resume — same effect as the owner's own toggle in My Vehicles. */
export const qrVehicleStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED']),
});

/** Admin correcting the number a scan rings — e.g. the owner lost that phone. */
export const qrVehicleContactSchema = z.object({
  contactPhone: z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
});

/**
 * Admin edit of a registered customer: everything the owner can edit on their
 * own vehicle, plus the car number (re-hashed server-side) and the account
 * holder's name/phone. Any subset may be sent.
 */
export const adminUpdateVehicleSchema = updateVehicleSchema.extend({
  plateNumber: RegisterVehicleInput.shape.plateNumber.optional(),
  customer: z.object({
    fullName: z.string().trim().min(2).max(80).optional(),
    phone:    z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number').optional(),
  }).optional(),
});
export type AdminUpdateVehicleInput = z.infer<typeof adminUpdateVehicleSchema>;

/** Admin correcting a sticker order's shipping details. */
export const adminQrOrderDetailsSchema = z.object({
  shippingName:  z.string().trim().min(2).max(80).optional(),
  shippingPhone: z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number').optional(),
  addressLine:   z.string().trim().min(5).max(300).optional(),
  city:          z.string().trim().min(2).max(80).optional(),
  state:         z.string().trim().min(2).max(80).optional(),
  pincode:       z.string().trim().regex(/^[0-9]{4,10}$/, 'Enter a valid pincode').optional(),
  note:          z.string().trim().max(300).nullable().optional(),
});
export type AdminQrOrderDetailsInput = z.infer<typeof adminQrOrderDetailsSchema>;

/** Generate a print run of unique QR sticker tokens. */
export const generateQrBatchSchema = z.object({
  label:    z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().min(1).max(2000),
  note:     z.string().trim().max(500).optional(),
});

export const updateQrBatchSchema = z.object({
  label:       z.string().trim().min(1).max(120).optional(),
  note:        z.string().trim().max(500).nullable().optional(),
  markPrinted: z.boolean().optional(),
});

export const qrStickerDisableSchema = z.object({
  disabled: z.boolean(),
  reason:   z.string().trim().max(200).optional(),
});

export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type VendorLeadStatusInput = z.infer<typeof vendorLeadStatusSchema>;
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type AdminSlotInput = z.infer<typeof adminSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type AdminEditGuestInput = z.infer<typeof adminEditGuestSchema>;
export type UpdateRegisteredCustomerInput = z.infer<typeof updateRegisteredCustomerSchema>;
export type UpdateGuestCustomerInput = z.infer<typeof updateGuestCustomerSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type CommissionRateInput = z.infer<typeof commissionRateSchema>;
export type CommissionStatusInput = z.infer<typeof commissionStatusSchema>;
export type ReassignVehicleInput = z.infer<typeof reassignVehicleSchema>;
export type CallDailyCapInput = z.infer<typeof callDailyCapSchema>;
export type CallLimitsInput = z.infer<typeof callLimitsSchema>;
export type BlockCallGloballyInput = z.infer<typeof blockCallGloballySchema>;
export type SetVehicleValidityInput = z.infer<typeof setVehicleValiditySchema>;
export type QrVehicleStatusInput = z.infer<typeof qrVehicleStatusSchema>;
export type QrVehicleContactInput = z.infer<typeof qrVehicleContactSchema>;
export type SetQrOrderStatusInput = z.infer<typeof setQrOrderStatusSchema>;
export type DispatchStickerInput = z.infer<typeof dispatchStickerSchema>;
export type GenerateQrBatchInput = z.infer<typeof generateQrBatchSchema>;
export type UpdateQrBatchInput = z.infer<typeof updateQrBatchSchema>;
export type QrStickerDisableInput = z.infer<typeof qrStickerDisableSchema>;
