import { z } from 'zod';
import { EmergencyContactInput, RegisterVehicleInput } from '@ps/types';

/** Register a new car — full shape, defined once in @ps/types. */
export const registerVehicleSchema = RegisterVehicleInput;

/**
 * Edit an existing registration. The plate is deliberately **not** editable
 * here: it's the lookup key (unique `plateHash`) and CallSession history
 * hangs off the registration, so "changing" a plate would silently reassign
 * that history to a different car. To fix a mistyped plate, delete the
 * registration and register again.
 *
 * Every field below is a plain `.optional()` (no `.default()`) — a PATCH/PUT
 * that omits a key must leave it untouched, not reset it. This reuses the
 * exact field validators from `RegisterVehicleInput` so the two schemas never
 * drift, just without its create-time defaults.
 */
const s = RegisterVehicleInput.shape;
export const updateVehicleSchema = z.object({
  contactPhone:      s.contactPhone.optional(),
  ownerName:         s.ownerName.nullable().optional(),
  silentFrom:        s.silentFrom.nullable(),
  silentTo:          s.silentTo.nullable(),
  dailyReceiveCap:   s.dailyReceiveCap.optional(),
  emergencyPublic:   z.boolean().optional(),
  bloodGroup:        s.bloodGroup.nullable().optional(),
  medicalNotes:      s.medicalNotes.nullable().optional(),
  emergencyContacts: z.array(EmergencyContactInput).max(5).optional(),
});
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
