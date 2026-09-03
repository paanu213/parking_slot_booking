import { z } from 'zod';
import { RegisterVehicleInput } from '@ps/types';

/**
 * Sticker request — a lean subset of RegisterVehicleInput (plate + contact
 * + optional owner name) so the request form stays quick. The full ICE
 * editor is still available afterward from "My Vehicles".
 */
const orderVehicleSchema = RegisterVehicleInput.pick({
  plateNumber:  true,
  contactPhone: true,
  ownerName:    true,
});

export const createQrOrderSchema = z.object({
  vehicle:       orderVehicleSchema,
  shippingName:  z.string().trim().min(2).max(80),
  shippingPhone: z.string().trim().min(8).max(20),
  addressLine:   z.string().trim().min(5).max(300),
  city:          z.string().trim().min(2).max(80),
  state:         z.string().trim().min(2).max(80),
  pincode:       z.string().trim().regex(/^[0-9]{4,10}$/, 'Enter a valid pincode'),
  note:          z.string().trim().max(300).optional(),
});
export type CreateQrOrderInput = z.infer<typeof createQrOrderSchema>;
