import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  phone:    z.string().min(7).max(20).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
