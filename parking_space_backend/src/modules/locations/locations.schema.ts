import { z } from 'zod';

export const searchSchema = z.object({
  q:        z.string().trim().optional(),
  city:     z.string().trim().optional(),
  area:     z.string().trim().optional(),
  lat:      z.coerce.number().optional(),
  lng:      z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).default(5),
  page:     z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
});

export const availabilitySchema = z.object({
  startAt: z.coerce.date(),
  endAt:   z.coerce.date(),
});

export type SearchInput = z.infer<typeof searchSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
