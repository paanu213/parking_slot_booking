import { z } from 'zod';

export const Role = z.enum(['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'VENDOR', 'CUSTOMER']);
export type Role = z.infer<typeof Role>;

export const UserDTO = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  role: Role,
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});
export type UserDTO = z.infer<typeof UserDTO>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RegisterInput = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).max(72),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LocationDTO = z.object({
  id: z.string(),
  name: z.string(),
  addressLine: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  isActive: z.boolean(),
});
export type LocationDTO = z.infer<typeof LocationDTO>;

export const BookingStatus = z.enum([
  'PENDING_PAYMENT',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'FAILED',
]);
export type BookingStatus = z.infer<typeof BookingStatus>;
