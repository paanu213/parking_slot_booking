import { z } from 'zod';

/**
 * Indian mobile number, matching the 10-digit field on the forms. Spaces,
 * dashes and a +91 / 91 / 0 prefix are tolerated and stripped, so what gets
 * stored is always the bare 10 digits (e.g. "9876543210").
 */
const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, ''))
  .refine((v) => /^[6-9]\d{9}$/.test(v), { message: 'Enter a valid 10-digit mobile number' });

// Prospect form submitted from the customer landing pages:
//  - PARKING  → "List your space"
//  - SERVICE  → "Become a service partner" (serviceCategory says which vertical)
export const leadSchema = z.object({
  leadType:        z.enum(['PARKING', 'SERVICE']).default('PARKING'),
  serviceCategory: z.string().trim().max(80).optional(),
  businessName: z.string().trim().min(2).max(120),
  fullName:     z.string().trim().min(2).max(80),
  email:        z.string().trim().email().max(120),
  phone:        mobileSchema,
  city:         z.string().trim().min(2).max(60),
  slotsApprox:  z.coerce.number().int().min(1).max(10_000).optional(),
  notes:        z.string().trim().max(1000).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
