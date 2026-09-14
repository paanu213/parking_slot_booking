/**
 * Payments service — Razorpay order creation + signature verification for
 * online bookings. QR sticker order payments live in qrOrders.service (same
 * Payment table, same gateway seam — see lib/paymentGateway) since they're a
 * different checkout flow with different amount/receipt logic; the Razorpay
 * webhook below is genuinely shared, since one Razorpay account/webhook URL
 * serves both flows.
 */
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { BadRequest, Forbidden, NotFound, ServerError } from '../../lib/http.js';
import type { NormalizedPaymentEvent } from '../../lib/paymentGateway/index.js';
import type { VerifyInput } from './payments.schema.js';
import { confirmOnPaymentOps } from '../qrOrders/qrOrders.service.js';

const rzp =
  env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
    : null;

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const createOrder = async (userId: string, bookingId: string) => {
  if (!rzp) throw ServerError('Payments not configured');

  const booking = await prisma.booking.findFirst({ where: { id: bookingId, userId } });
  if (!booking) throw NotFound('Booking not found');
  if (booking.status !== 'PENDING_PAYMENT') {
    throw BadRequest(`Booking is ${booking.status.toLowerCase()} — cannot create a new order`);
  }

  const order = await rzp.orders.create({
    amount:   Math.round(Number(booking.totalAmount) * 100),
    currency: booking.currency,
    receipt:  booking.reference,
  });

  // Reuse an existing CREATED payment row (e.g. user retried) instead of
  // littering the table with orphaned attempts.
  const existing = await prisma.payment.findFirst({
    where:   { bookingId: booking.id, status: 'CREATED' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data:  { providerOrderId: order.id, amount: booking.totalAmount, currency: booking.currency },
    });
  } else {
    await prisma.payment.create({
      data: {
        bookingId:       booking.id,
        providerOrderId: order.id,
        amount:          booking.totalAmount,
        currency:        booking.currency,
      },
    });
  }

  return {
    orderId:  order.id,
    keyId:    env.RAZORPAY_KEY_ID,
    amount:   order.amount,
    currency: order.currency,
  };
};

export const verifyPayment = async (userId: string, input: VerifyInput) => {
  if (!env.RAZORPAY_KEY_SECRET) throw ServerError('Payments not configured');
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (!timingSafeEqual(expected, razorpay_signature)) throw BadRequest('Invalid signature');

  // `providerOrderId` is not a unique field, so look up first.
  const payment = await prisma.payment.findFirst({
    where:   { providerOrderId: razorpay_order_id },
    include: { booking: true },
  });
  if (!payment || !payment.booking) throw NotFound('Payment not found');
  if (payment.booking.userId !== userId) throw Forbidden('Not your payment');

  // Idempotent: if already PAID we just return ok.
  if (payment.status !== 'PAID') {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data:  { status: 'PAID', providerPaymentId: razorpay_payment_id },
      }),
      prisma.booking.update({
        where: { id: payment.booking.id },
        data:  { status: 'CONFIRMED' },
      }),
    ]);
  }
  return { ok: true };
};

/**
 * Reconciliation path for the Razorpay webhook (modules/webhooks/webhooks.routes.ts
 * already verified the signature before calling this — never call it with an
 * unverified event). Covers whichever of the two checkout flows this Payment
 * row belongs to (bookingId xor qrOrderId), and is fully idempotent: Razorpay
 * retries webhook delivery, and the customer's own verify call may well have
 * already landed the same outcome first.
 */
export const applyRazorpayWebhookEvent = async (event: NormalizedPaymentEvent) => {
  if (event.status === 'IGNORED') return;

  const payment = event.providerPaymentId
    ? await prisma.payment.findFirst({ where: { providerPaymentId: event.providerPaymentId } })
    : event.providerOrderId
      ? await prisma.payment.findFirst({ where: { providerOrderId: event.providerOrderId }, orderBy: { createdAt: 'desc' } })
      : null;

  if (!payment) {
    logger.warn({ event: 'razorpay_webhook_unmatched', providerOrderId: event.providerOrderId, providerPaymentId: event.providerPaymentId }, 'Razorpay webhook did not match any known payment');
    return;
  }

  // Never let a late/duplicate/failed event downgrade a payment we've already captured.
  if (payment.status === 'PAID') return;

  if (event.status === 'PAID') {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          providerPaymentId: event.providerPaymentId ?? payment.providerPaymentId,
          rawResponse: JSON.stringify(event.raw),
        },
      });
      if (payment.bookingId) {
        await tx.booking.update({ where: { id: payment.bookingId }, data: { status: 'CONFIRMED' } });
      }
      if (payment.qrOrderId) {
        const order = await tx.qrOrder.findUnique({ where: { id: payment.qrOrderId } });
        await tx.qrOrder.update({
          where: { id: payment.qrOrderId },
          data: {
            paymentStatus: 'PAID',
            paidAt: new Date(),
            paymentRef: event.providerPaymentId ?? payment.providerPaymentId ?? payment.id,
          },
        });
        if (order) await Promise.all(confirmOnPaymentOps(tx, order));
      }
    });
    logger.info({ event: 'razorpay_webhook_paid', paymentId: payment.id, bookingId: payment.bookingId, qrOrderId: payment.qrOrderId }, 'Razorpay webhook reconciled a payment as PAID');
    return;
  }

  // event.status === 'FAILED'
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        providerPaymentId: event.providerPaymentId ?? payment.providerPaymentId,
        failureCode:   event.failureCode ?? null,
        failureReason: event.failureReason ?? 'Payment failed',
        rawResponse:   JSON.stringify(event.raw),
      },
    });
    if (payment.qrOrderId) {
      const order = await tx.qrOrder.findUnique({ where: { id: payment.qrOrderId } });
      if (order && order.paymentStatus !== 'PAID') {
        await tx.qrOrder.update({ where: { id: payment.qrOrderId }, data: { paymentStatus: 'FAILED' } });
      }
    }
    // Booking side: leave booking.status alone — PENDING_PAYMENT already
    // means "not paid yet" and the customer can simply retry checkout.
  });
  logger.warn({ event: 'razorpay_webhook_failed', paymentId: payment.id, bookingId: payment.bookingId, qrOrderId: payment.qrOrderId, failureCode: event.failureCode }, 'Razorpay webhook reconciled a payment as FAILED');
};
