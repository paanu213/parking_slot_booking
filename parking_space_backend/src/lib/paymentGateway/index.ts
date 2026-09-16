import { env } from '../../config/env.js';
import { ServerError } from '../http.js';
import type { PaymentGateway } from './types.js';
import { createRazorpayGateway } from './razorpay.js';

let cached: PaymentGateway | null = null;

/**
 * The single Razorpay gateway instance. Callers (qrOrders.service, the
 * webhook route, admin.service refunds) only ever talk to the
 * PaymentGateway interface, never to Razorpay's SDK directly. Throws
 * clearly if the account isn't configured yet — there is no simulated
 * fallback, so a misconfigured deploy fails loudly at the point of use
 * rather than silently faking payments.
 */
export const getGateway = (): PaymentGateway => {
  if (cached) return cached;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw ServerError('Payments are not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
  }
  cached = createRazorpayGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET);
  return cached;
};

export type {
  PaymentGateway, CreateGatewayOrderParams, CreateGatewayOrderResult,
  SignatureVerifyParams, NormalizedPaymentEvent, FetchedPayment,
} from './types.js';
