import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import type {
  PaymentGateway, CreateGatewayOrderParams, SignatureVerifyParams, NormalizedPaymentEvent, FetchedPayment,
} from './types.js';

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

/**
 * The real, production Razorpay integration. Constructed only once both
 * RAZORPAY_KEY_ID / _KEY_SECRET are set — see index.ts.
 */
export const createRazorpayGateway = (keyId: string, keySecret: string, webhookSecret?: string): PaymentGateway => {
  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

  return {
    name: 'razorpay',
    publicKeyId: keyId,

    async createOrder({ amountPaise, currency, receipt, notes }: CreateGatewayOrderParams) {
      const order = await rzp.orders.create({ amount: amountPaise, currency, receipt, notes });
      return { providerOrderId: order.id, amount: Number(order.amount), currency: order.currency };
    },

    // The one cryptographic fact that proves *this specific* payment really
    // happened — Razorpay signs order_id|payment_id with the account's key
    // secret, which only Razorpay and we ever hold. A client can send us
    // anything it wants; only a signature that verifies against this HMAC
    // is trusted as a real "paid" event.
    verifySignature({ orderId, paymentId, signature }: SignatureVerifyParams) {
      const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
      return timingSafeEqual(expected, signature);
    },

    // Belt-and-braces beyond the signature: ask Razorpay directly whether
    // this payment id is actually captured, and for how much. Guards against
    // a compromised/buggy client sending a well-formed but stale signature
    // for a payment that was later refunded, or any order/amount mismatch.
    async fetchPayment(paymentId: string): Promise<FetchedPayment | null> {
      const p = await rzp.payments.fetch(paymentId);
      if (!p) return null;
      return { status: String(p.status), amountPaise: Number(p.amount), currency: String(p.currency) };
    },

    verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
      if (!webhookSecret || !signature) return false;
      const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      return timingSafeEqual(expected, signature);
    },

    parseWebhookEvent(rawBody: Buffer): NormalizedPaymentEvent {
      const body = JSON.parse(rawBody.toString('utf8'));
      const event = body.event as string;
      const entity = body.payload?.payment?.entity ?? {};
      const providerOrderId = entity.order_id ?? null;
      const providerPaymentId = entity.id ?? null;
      const amount = entity.amount != null ? Number(entity.amount) : null;
      const currency = entity.currency ?? null;

      if (event === 'payment.captured' || event === 'order.paid') {
        return { providerOrderId, providerPaymentId, status: 'PAID', amount, currency, raw: body };
      }
      if (event === 'payment.failed') {
        return {
          providerOrderId, providerPaymentId, status: 'FAILED', amount, currency,
          failureCode:   entity.error_code ?? undefined,
          failureReason: entity.error_description ?? 'Payment failed',
          raw: body,
        };
      }
      // Any other event (refunds, disputes, …) — not something this flow acts on yet.
      return { providerOrderId, providerPaymentId, status: 'IGNORED', amount, currency, raw: body };
    },
  };
};
