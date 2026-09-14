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

// ── Payment (Razorpay, or the demo gateway — see lib/paymentGateway) ────────

/** The 3-field proof Razorpay Checkout hands back on success — server-verified before anything is trusted. */
export const verifyQrPaymentSchema = z.object({
  razorpay_order_id:   z.string().trim().min(1).max(100),
  razorpay_payment_id: z.string().trim().min(1).max(100),
  razorpay_signature:  z.string().trim().min(1).max(200),
});
export type VerifyQrPaymentInput = z.infer<typeof verifyQrPaymentSchema>;

/**
 * Client-reported failure — Razorpay Checkout's `payment.failed` event (card
 * declined, bank timeout, etc). Only ever used to log/display a FAILED
 * attempt, never to mark anything paid, so there's no trust issue in taking
 * the client's word for *why* it failed.
 */
export const qrPaymentFailedSchema = z.object({
  providerOrderId: z.string().trim().max(100).optional(),
  code:            z.string().trim().max(100).optional(),
  description:     z.string().trim().max(500).optional(),
  reason:          z.string().trim().max(200).optional(),
  source:          z.string().trim().max(100).optional(),
  step:            z.string().trim().max(100).optional(),
});
export type QrPaymentFailedInput = z.infer<typeof qrPaymentFailedSchema>;

export const qrPaymentCancelSchema = z.object({
  providerOrderId: z.string().trim().max(100).optional(),
});
export type QrPaymentCancelInput = z.infer<typeof qrPaymentCancelSchema>;

/**
 * Demo-mode-only "complete checkout" — the frontend's Simulate Success/Failure
 * buttons call this instead of ever computing a signature client-side. The
 * backend fabricates the payment id and signs it itself (see
 * lib/paymentGateway/demo.ts), then runs the SAME verifyQrPayment path a real
 * gateway would — so nothing here bypasses the standard trust chain. Refused
 * outright once real Razorpay keys are configured (qrOrders.service checks
 * getGateway().name === 'demo' first).
 */
export const qrDemoCompleteSchema = z.object({
  providerOrderId: z.string().trim().min(1).max(100),
  outcome:         z.enum(['success', 'failure']),
});
export type QrDemoCompleteInput = z.infer<typeof qrDemoCompleteSchema>;
