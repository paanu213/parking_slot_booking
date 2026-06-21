import { z } from 'zod';

export const createBookingSchema = z
  .object({
    slotId:      z.string().min(1),
    bookingType: z.enum(['HOURLY', 'MONTHLY']).default('HOURLY'),
    startAt:     z.coerce.date(),
    endAt:       z.coerce.date().optional(),
  })
  .refine(
    (d) => d.bookingType === 'MONTHLY' || (d.endAt && d.endAt > d.startAt),
    { message: 'endAt must be after startAt for hourly bookings' },
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
