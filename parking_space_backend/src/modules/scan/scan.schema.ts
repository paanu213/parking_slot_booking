import { z } from 'zod';

export { LookupInput as lookupSchema } from '@ps/types';

export const emergencyQuerySchema = z.object({
  permit: z.string().min(1, 'Missing permit'),
});
export type EmergencyQuery = z.infer<typeof emergencyQuerySchema>;
