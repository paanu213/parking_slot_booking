import { z } from 'zod';

// "List your space" prospect form submitted from the customer landing page.
export const leadSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  fullName:     z.string().trim().min(2).max(80),
  email:        z.string().trim().email().max(120),
  phone:        z.string().trim().min(7).max(20),
  city:         z.string().trim().min(2).max(60),
  slotsApprox:  z.coerce.number().int().min(1).max(10_000).optional(),
  notes:        z.string().trim().max(1000).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
