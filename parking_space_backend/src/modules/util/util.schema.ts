import { z } from 'zod';

// Prospect form submitted from the customer landing pages:
//  - PARKING  → "List your space"
//  - SERVICE  → "Become a service partner" (serviceCategory says which vertical)
export const leadSchema = z.object({
  leadType:        z.enum(['PARKING', 'SERVICE']).default('PARKING'),
  serviceCategory: z.string().trim().max(80).optional(),
  businessName: z.string().trim().min(2).max(120),
  fullName:     z.string().trim().min(2).max(80),
  email:        z.string().trim().email().max(120),
  phone:        z.string().trim().min(7).max(20),
  city:         z.string().trim().min(2).max(60),
  slotsApprox:  z.coerce.number().int().min(1).max(10_000).optional(),
  notes:        z.string().trim().max(1000).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
