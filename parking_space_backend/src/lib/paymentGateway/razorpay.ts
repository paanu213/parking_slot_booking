import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { BadRequest } from '../http.js';
import type {
  PaymentGateway, CreateGatewayOrderParams, SignatureVerifyParams, NormalizedPaymentEvent, FetchedPayment,
  RefundParams, RefundResult,
} from './types.js';

/**
 * The Razorpay SDK throws a plain `{ statusCode, error }` object on API
 * failures, not an Error — left uncaught, that reaches the Express error
 * handler as an unrecognized value and surfaces as an opaque "Internal
 * server error". Translate it into a proper HttpError with whatever
 * description Razorpay gave (a legacy/demo-era payment id that doesn't
 * really exist at Razorpay is the most common case here).
 */
const asBadRequest = (action: string, e: unknown): never => {
  const err = e as { statusCode?: number; error?: { description?: string; code?: string }; message?: string } | undefined;
  const description = err?.error?.description ?? err?.message ?? `Unknown gateway error${err?.statusCode ? ` (HTTP ${err.statusCode})` : ''}`;
  throw BadRequest(`Razorpay ${action} failed: ${description}`);
};

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
      try {
        const order = await rzp.orders.create({ amount: amountPaise, currency, receipt, notes });
        return { providerOrderId: order.id, amount: Number(order.amount), currency: order.currency };
      } catch (e) {
        return asBadRequest('order creation', e);
      }
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

    // Real money movement — call this BEFORE ever marking anything REFUNDED
    // in our own DB. Razorpay refunds are idempotent per amount+payment when
    // a `receipt`/idempotency key isn't reused across different amounts, but
    // we still only ever call this once per admin action (see admin.service).
    async refund({ paymentId, amountPaise, notes }: RefundParams): Promise<RefundResult> {
      try {
        const refund = await rzp.payments.refund(paymentId, { amount: amountPaise, notes });
        return { providerRefundId: refund.id, status: String(refund.status) };
      } catch (e) {
        return asBadRequest('refund', e);
      }
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
      // Refund events carry a `refund` entity alongside the `payment` entity —
      // payment_id there is the authoritative link back to our Payment row.
      // Covers refunds initiated from the Razorpay dashboard directly, not
      // just ones our own admin UI triggers (see admin.service.refundBooking
      // / refundQrOrder, which call gateway.refund() and don't need to wait
      // for this webhook, but a dashboard-initiated refund only ever reaches
      // us through here).
      if (event === 'refund.processed' || event === 'refund.created') {
        const refundEntity = body.payload?.refund?.entity ?? {};
        return {
          providerOrderId,
          providerPaymentId: refundEntity.payment_id ?? providerPaymentId,
          status: 'REFUNDED',
          amount: refundEntity.amount != null ? Number(refundEntity.amount) : amount,
          currency: refundEntity.currency ?? currency,
          providerRefundId: refundEntity.id ?? null,
          raw: body,
        };
      }
      // Any other event (disputes, subscriptions, …) — not something this flow acts on yet.
      return { providerOrderId, providerPaymentId, status: 'IGNORED', amount, currency, raw: body };
    },
  };
};
