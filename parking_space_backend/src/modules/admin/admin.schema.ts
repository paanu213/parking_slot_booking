import { z } from 'zod';

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

export const blockCallGloballySchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export const setQrOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
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
export type BlockCallGloballyInput = z.infer<typeof blockCallGloballySchema>;
export type SetQrOrderStatusInput = z.infer<typeof setQrOrderStatusSchema>;
