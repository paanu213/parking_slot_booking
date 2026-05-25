import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import Razorpay from 'razorpay';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { env } from '../../config/env.js';
import { BadRequest, Forbidden, NotFound, ServerError } from '../../lib/http.js';

const r = Router();
r.use(requireAuth);

const rzp =
  env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
    : null;

// ---------------------------------------------------------------------------
// Create order
// ---------------------------------------------------------------------------

const createOrderSchema = z.object({ bookingId: z.string().min(1) });

r.post('/create-order', validate(createOrderSchema), async (req, res, next) => {
  try {
    if (!rzp) throw ServerError('Payments not configured');
    const { bookingId } = req.body as z.infer<typeof createOrderSchema>;

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: req.user!.sub },
    });
    if (!booking) throw NotFound('Booking not found');
    if (booking.status !== 'PENDING_PAYMENT') {
      throw BadRequest(`Booking is ${booking.status.toLowerCase()} — cannot create a new order`);
    }

    const order = await rzp.orders.create({
      amount: Math.round(Number(booking.totalAmount) * 100),
      currency: booking.currency,
      receipt: booking.reference,
    });

    // Reuse an existing CREATED payment row (e.g. user retried) instead of
    // littering the table with orphaned attempts.
    const existing = await prisma.payment.findFirst({
      where: { bookingId: booking.id, status: 'CREATED' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      await prisma.payment.update({
        where: { id: existing.id },
        data: { providerOrderId: order.id, amount: booking.totalAmount, currency: booking.currency },
      });
    } else {
      await prisma.payment.create({
        data: {
          bookingId: booking.id,
          providerOrderId: order.id,
          amount: booking.totalAmount,
          currency: booking.currency,
        },
      });
    }

    res.json({
      orderId: order.id,
      keyId: env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

r.post('/verify', validate(verifySchema), async (req, res, next) => {
  try {
    if (!env.RAZORPAY_KEY_SECRET) throw ServerError('Payments not configured');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as z.infer<
      typeof verifySchema
    >;

    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (!timingSafeEqual(expected, razorpay_signature)) throw BadRequest('Invalid signature');

    // `providerOrderId` is not a unique field, so look up first.
    const payment = await prisma.payment.findFirst({
      where: { providerOrderId: razorpay_order_id },
      include: { booking: true },
    });
    if (!payment) throw NotFound('Payment not found');
    if (payment.booking.userId !== req.user!.sub) throw Forbidden('Not your payment');

    // Idempotent: if already PAID we just return ok.
    if (payment.status !== 'PAID') {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'PAID', providerPaymentId: razorpay_payment_id },
        }),
        prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'CONFIRMED' },
        }),
      ]);
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default r;
