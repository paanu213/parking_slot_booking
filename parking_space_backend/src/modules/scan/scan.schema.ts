import { z } from 'zod';
import { RegisterVehicleInput } from '@ps/types';

export { LookupInput as lookupSchema } from '@ps/types';

/**
 * Revealing the emergency card requires the scanner's own mobile number —
 * same requirement as placing a masked call (CallPanel) — not just being
 * signed in. Self-reported (no OTP), but it makes viewing sensitive family
 * contact info traceable the same way a call is, and matches the "enter
 * your number first" flow on both actions.
 */
export const revealEmergencySchema = z.object({
  permit:       z.string().min(1, 'Missing permit'),
  callerNumber: z.string().trim().min(8, 'Enter a valid phone number').max(20),
});
export type RevealEmergencyInput = z.infer<typeof revealEmergencySchema>;

/**
 * Owner's first-scan setup of a unique sticker — the full vehicle profile
 * (same fields "My Vehicles" edits later), not just plate + number: silent
 * hours and the opt-in emergency (ICE) card can be set right here instead of
 * a separate trip. If the owner already has a registration for this plate
 * (added earlier via My Vehicles, or a previous sticker), the frontend
 * pre-fills these from GET /customer/me/vehicles/by-plate/:plate and the
 * owner just reviews/edits before confirming.
 */
export const configureStickerSchema = RegisterVehicleInput;
export type ConfigureStickerInput = z.infer<typeof configureStickerSchema>;

/** Passer-by proves physical presence at the car by entering the last 4 of the plate. */
export const verifyPlateSchema = z.object({
  last4: z.string().trim().min(1).max(6).transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')),
});
export type VerifyPlateInput = z.infer<typeof verifyPlateSchema>;
