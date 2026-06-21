import { z } from 'zod';

export const createOrderSchema = z.object({ bookingId: z.string().min(1) });

export const verifySchema = z.object({
  razorpay_order_id:   z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature:  z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
