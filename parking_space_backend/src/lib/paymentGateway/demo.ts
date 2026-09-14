import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import type {
  PaymentGateway, CreateGatewayOrderParams, SignatureVerifyParams, NormalizedPaymentEvent,
} from './types.js';

/**
 * Demo/dev provider — no Razorpay account needed. `createOrder` mints a
 * locally-generated fake order id; `verifySignature` checks a signature
 * computed with a fixed local secret (never sent to the frontend) instead of
 * trusting the client's "it worked" flag outright — so the exact same
 * "verify, don't trust" code path in qrOrders.service runs whether this is
 * the demo gateway or the real one. There is no real webhook delivery in
 * demo mode (nothing external ever calls us), so verifyWebhookSignature
 * always fails closed rather than accepting anything.
 *
 * Swap to real payments by setting RAZORPAY_KEY_ID / _KEY_SECRET /
 * _WEBHOOK_SECRET — see index.ts. Nothing in qrOrders.service, the routes,
 * or the frontend checkout code needs to change.
 */
const DEMO_SECRET = 'autosahay-demo-payment-gateway-v1';

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

/** Exported so the demo-checkout endpoints can mint a valid signature server-side. */
export const demoSign = (orderId: string, paymentId: string) =>
  crypto.createHmac('sha256', DEMO_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

export const demoGateway: PaymentGateway = {
  name: 'demo',
  publicKeyId: '',

  async createOrder({ amountPaise, currency }: CreateGatewayOrderParams) {
    return { providerOrderId: `order_DEMO${nanoid(14)}`, amount: amountPaise, currency };
  },

  verifySignature({ orderId, paymentId, signature }: SignatureVerifyParams) {
    return timingSafeEqual(demoSign(orderId, paymentId), signature);
  },

  verifyWebhookSignature() {
    return false;
  },

  parseWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent {
    return {
      providerOrderId: null, providerPaymentId: null, status: 'IGNORED',
      amount: null, currency: null, raw: rawBody.toString('utf8'),
    };
  },
};
