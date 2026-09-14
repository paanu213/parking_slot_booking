import { env } from '../../config/env.js';
import type { PaymentGateway } from './types.js';
import { demoGateway } from './demo.js';
import { createRazorpayGateway } from './razorpay.js';

let cached: PaymentGateway | null = null;

/**
 * Picks the real Razorpay gateway once RAZORPAY_KEY_ID / _KEY_SECRET are
 * set, the demo gateway otherwise — see demo.ts and env.ts. Callers
 * (qrOrders.service, the webhook route) only ever talk to the PaymentGateway
 * interface, never to Razorpay's SDK directly, so this is the only place
 * that needs to know which one is active.
 */
export const getGateway = (): PaymentGateway => {
  if (cached) return cached;
  cached =
    env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
      ? createRazorpayGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET)
      : demoGateway;
  return cached;
};

export type {
  PaymentGateway, CreateGatewayOrderParams, CreateGatewayOrderResult,
  SignatureVerifyParams, NormalizedPaymentEvent, FetchedPayment,
} from './types.js';
