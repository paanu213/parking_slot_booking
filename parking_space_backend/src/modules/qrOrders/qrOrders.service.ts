/**
 * Sticker orders — "Get your QR sticker" landing page -> account (Google) ->
 * vehicle + shipping -> preview -> Razorpay payment.
 *
 * Payment is a 3-step handshake, never a bare "trust the client" flag:
 *   1. createQrCheckout  — opens a Payment(CREATED) row + a gateway order.
 *   2. verifyQrPayment   — the ONLY path that can mark an order PAID; it
 *      cryptographically verifies the gateway's signature (and, on the real
 *      gateway, cross-checks the payment with Razorpay directly) before
 *      trusting anything the browser sends back.
 *   3. The Razorpay webhook (modules/webhooks -> payments.service) is the
 *      reconciliation path for step 2 never firing — the user closes the
 *      tab, the network drops after the bank confirms, etc.
 * reportQrPaymentFailure / reportQrPaymentCancelled log client-reported
 * failures/cancellations for the customer + admin UI; being client-reported
 * they can only ever move a payment to FAILED, never to PAID.
 */
import type { Prisma } from '@prisma/client';
import { getStickerPricePaise } from '../../lib/qrPricing.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../config/logger.js';
import { getGateway } from '../../lib/paymentGateway/index.js';
import { BadRequest, Forbidden, HttpError, NotFound } from '../../lib/http.js';
import { decryptField, hmacHash } from '../../lib/crypto.js';
import * as vehiclesService from '../vehicles/vehicles.service.js';
import type {
  CreateQrOrderInput, VerifyQrPaymentInput, QrPaymentFailedInput,
} from './qrOrders.schema.js';

/**
 * Snapshot at request time — a later price change never rewrites past orders.
 * One-time fee, valid for 10 years by default (lib/qrValidity.ts); MONTHLY_PRICE_PAISE stays at 0
 * (there is no recurring charge) — the column is kept so past two-part orders
 * still read back correctly. Admin can set a per-vehicle expiry from the
 * 10-year default under individual commercial terms (VehicleRegistration.validUntil).
 */
// The sticker price is admin-configurable (lib/qrPricing.ts, QR Config page).
// Each order snapshots the price at creation, so old orders keep their amount.
export const MONTHLY_PRICE_PAISE = 0;

type Db = typeof prisma | Prisma.TransactionClient;

/**
 * The fulfilment side of a successful payment: PENDING -> CONFIRMED,
 * automatically, the instant money lands — the customer should never see
 * "Pending" after paying. Everything after this (pickup, dispatch, delivery,
 * returns) is admin-driven from admin.service's setQrOrderStatus. A no-op if
 * the order isn't PENDING (e.g. a webhook retry landing after the customer's
 * own verify call already ran this).
 */
export const confirmOnPaymentOps = (db: Db, order: { id: string; status: string }) =>
  order.status === 'PENDING'
    ? [
        db.qrOrder.update({ where: { id: order.id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } }),
        db.qrOrderStatusEvent.create({
          data: { qrOrderId: order.id, status: 'CONFIRMED', note: 'Order confirmed, payment received' },
        }),
      ]
    : [];

export const createQrOrder = async (userId: string, input: CreateQrOrderInput) => {
  // Register the car, but reuse an existing registration of this user's own
  // instead of failing if they already registered this plate (e.g. via "My
  // Vehicles") before finding this page.
  let registration;
  try {
    // orderVehicleSchema only picks 3 fields — fill in the rest of
    // RegisterVehicleInput's defaults explicitly (ICE stays off; the owner
    // can turn it on later from "My Vehicles").
    registration = await vehiclesService.registerVehicle(userId, { ...input.vehicle, emergencyPublic: false });
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      const plateHash = hmacHash(input.vehicle.plateNumber); // already normalized by the zod transform
      const existing = await prisma.vehicleRegistration.findUnique({ where: { plateHash } });
      if (existing && existing.userId === userId && existing.status !== 'DELETED') {
        registration = await vehiclesService.getVehicle(userId, existing.id);
      } else {
        throw e; // genuinely owned by someone else — surface the real conflict
      }
    } else {
      throw e;
    }
  }

  const stickerPricePaise = await getStickerPricePaise();

  // One contact per order: the courier uses the vehicle's name and contact number.
  const shippingPhone = input.shippingPhone ?? input.vehicle.contactPhone;
  const shippingName =
    input.shippingName ?? (input.vehicle.ownerName?.trim() || (await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }))?.fullName || 'Customer');

  const order = await prisma.qrOrder.create({
    data: {
      userId,
      registrationId:    registration.id,
      stickerPricePaise,
      monthlyPricePaise: MONTHLY_PRICE_PAISE,
      source:            'WEBSITE',
      channel:           'WEBSITE', // order type; admin-created orders overwrite this
      paymentMode:       'ONLINE',
      shippingName,
      shippingPhone,
      addressLine:   input.addressLine,
      city:          input.city,
      state:         input.state,
      pincode:       input.pincode,
      note:          input.note ?? null,
    },
  });

  return { order, registration };
};

export const listMyQrOrders = async (userId: string) => {
  const rows = await prisma.qrOrder.findMany({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      registration: {
        select: {
          plateNumber: true,
          qrStickers: { where: { status: 'CLAIMED' }, select: { id: true }, take: 1 },
        },
      },
    },
  });
  return {
    items: rows.map(({ registration, ...r }) => ({
      ...r,
      plate: registration ? decryptField(registration.plateNumber) : null,
      // Has the physical sticker actually been scanned + configured for this
      // car yet? Separate from `paymentStatus` — paying ships a sticker, this
      // is whether it's been scanned and linked since.
      qrLinked: (registration?.qrStickers?.length ?? 0) > 0,
    })),
  };
};

export const getMyQrOrder = async (userId: string, id: string) => {
  const order = await prisma.qrOrder.findUnique({ where: { id } });
  if (!order || order.userId !== userId) throw NotFound('Order not found');
  return order;
};

export interface AttemptMeta {
  ip: string;
  userAgent?: string;
}

// monthlyPricePaise is always 0 on new orders (see STICKER_PRICE_PAISE) — the
// sum is kept only so an old two-part order (pre one-time-fee pricing) would
// still total correctly if it were ever re-paid.
const orderAmountPaise = (order: { stickerPricePaise: number; monthlyPricePaise: number }) =>
  order.stickerPricePaise + order.monthlyPricePaise;

/** Opens (or reopens, on retry) a payment attempt for this order's one-time fee. */
export const createQrCheckout = async (userId: string, qrOrderId: string, meta: AttemptMeta) => {
  const order = await prisma.qrOrder.findUnique({ where: { id: qrOrderId } });
  if (!order || order.userId !== userId) throw NotFound('Order not found');
  if (order.paymentStatus === 'PAID') throw BadRequest('This order is already paid');

  const gateway = getGateway();
  const amountPaise = orderAmountPaise(order);

  const gatewayOrder = await gateway.createOrder({
    amountPaise,
    currency: 'INR',
    receipt:  order.id,
    notes:    { qrOrderId: order.id, userId },
  });

  // Reuse a still-open (never-completed) attempt instead of littering the
  // table with orphaned CREATED rows every time the customer clicks Pay.
  const existing = await prisma.payment.findFirst({
    where:   { qrOrderId: order.id, status: 'CREATED' },
    orderBy: { createdAt: 'desc' },
  });

  const attemptData = {
    provider:        gateway.name,
    providerOrderId: gatewayOrder.providerOrderId,
    amount:          amountPaise / 100,
    currency:        gatewayOrder.currency,
    ipHash:          hmacHash(meta.ip),
    userAgent:       meta.userAgent?.slice(0, 500),
  };

  const payment = existing
    ? await prisma.payment.update({ where: { id: existing.id }, data: attemptData })
    : await prisma.payment.create({ data: { qrOrderId: order.id, ...attemptData } });

  logger.info(
    { event: 'qr_payment_order_created', qrOrderId: order.id, paymentId: payment.id, provider: gateway.name, amountPaise },
    'QR payment order created',
  );

  return {
    keyId:     gateway.publicKeyId,
    orderId:   gatewayOrder.providerOrderId,
    amount:    gatewayOrder.amount,
    currency:  gatewayOrder.currency,
    name:      'AutoSahay',
    description: 'QR sticker pack of 2, one-time payment, valid for 10 years',
  };
};

/**
 * The only function that may mark an order PAID. Never trusts the browser's
 * "it worked" call on its own — verifies the gateway's HMAC signature, then
 * (real gateway only) cross-checks the payment with Razorpay directly.
 */
export const verifyQrPayment = async (userId: string, qrOrderId: string, input: VerifyQrPaymentInput, meta: AttemptMeta) => {
  const order = await prisma.qrOrder.findUnique({ where: { id: qrOrderId } });
  if (!order || order.userId !== userId) throw NotFound('Order not found');
  if (order.paymentStatus === 'PAID') return order; // idempotent — a retried verify call after success

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;

  const payment = await prisma.payment.findFirst({ where: { providerOrderId: razorpay_order_id } });
  // Must exist and belong to *this* order — stops a signature/response from
  // one checkout being replayed against a different order id in the URL.
  if (!payment || payment.qrOrderId !== order.id) throw Forbidden('Payment does not match this order');

  const gateway = getGateway();
  const validSignature = gateway.verifySignature({
    orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature,
  });

  if (!validSignature) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED', providerPaymentId: razorpay_payment_id,
        failureCode: 'INVALID_SIGNATURE', failureReason: 'Payment signature verification failed',
        ipHash: hmacHash(meta.ip), userAgent: meta.userAgent?.slice(0, 500),
      },
    });
    logger.warn(
      { event: 'qr_payment_signature_invalid', qrOrderId: order.id, paymentId: payment.id },
      'QR payment signature did not verify, possible tampering',
    );
    throw BadRequest('Payment verification failed');
  }

  // Defense-in-depth beyond the signature: ask the gateway directly whether
  // this payment id is really captured and for the right amount.
  if (gateway.fetchPayment) {
    const expectedPaise = Math.round(Number(payment.amount) * 100);
    const fetched = await gateway.fetchPayment(razorpay_payment_id).catch(() => null);
    if (!fetched || fetched.status !== 'captured' || fetched.amountPaise !== expectedPaise) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED', providerPaymentId: razorpay_payment_id,
          failureCode: 'GATEWAY_CROSSCHECK_FAILED',
          failureReason: 'Payment could not be confirmed with the gateway',
        },
      });
      logger.error(
        { event: 'qr_payment_crosscheck_failed', qrOrderId: order.id, paymentId: payment.id, fetched },
        'QR payment failed gateway cross-check',
      );
      throw BadRequest('Payment could not be confirmed. Contact support if money was deducted');
    }
  }

  const [, updatedOrder] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID', providerPaymentId: razorpay_payment_id,
        rawResponse: JSON.stringify({ razorpay_order_id, razorpay_payment_id }),
      },
    }),
    prisma.qrOrder.update({
      where: { id: order.id },
      data:  { paymentStatus: 'PAID', paidAt: new Date(), paymentRef: razorpay_payment_id },
    }),
    ...confirmOnPaymentOps(prisma, order),
  ]);

  logger.info({ event: 'qr_payment_success', qrOrderId: order.id, paymentId: payment.id }, 'QR payment verified and captured');
  return updatedOrder;
};

const findOpenAttempt = (qrOrderId: string, providerOrderId?: string) =>
  providerOrderId
    ? prisma.payment.findFirst({ where: { providerOrderId, qrOrderId } })
    : prisma.payment.findFirst({ where: { qrOrderId, status: 'CREATED' }, orderBy: { createdAt: 'desc' } });

/**
 * Client-reported failure (Razorpay Checkout's `payment.failed` — card
 * declined, bank timeout, network drop mid-flow, …). Self-reported, so it
 * can only ever move a payment to FAILED — logged for the customer's retry
 * banner and the admin payments log, never trusted to mark anything paid.
 */
export const reportQrPaymentFailure = async (userId: string, qrOrderId: string, input: QrPaymentFailedInput, meta: AttemptMeta) => {
  const order = await prisma.qrOrder.findUnique({ where: { id: qrOrderId } });
  if (!order || order.userId !== userId) throw NotFound('Order not found');

  const payment = await findOpenAttempt(order.id, input.providerOrderId);
  if (payment && payment.status !== 'PAID') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureCode:   input.code ?? 'PAYMENT_FAILED',
        failureReason: input.description ?? input.reason ?? 'Payment failed',
        ipHash: hmacHash(meta.ip), userAgent: meta.userAgent?.slice(0, 500),
        rawResponse: JSON.stringify(input),
      },
    });
  }
  if (order.paymentStatus !== 'PAID') {
    await prisma.qrOrder.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } });
  }

  logger.warn({ event: 'qr_payment_client_failed', qrOrderId: order.id, paymentId: payment?.id, ...input }, 'QR payment reported failed by client');
  return { ok: true };
};

/** The customer closed the checkout modal without paying. */
export const reportQrPaymentCancelled = async (userId: string, qrOrderId: string, providerOrderId: string | undefined, meta: AttemptMeta) => {
  const order = await prisma.qrOrder.findUnique({ where: { id: qrOrderId } });
  if (!order || order.userId !== userId) throw NotFound('Order not found');

  const payment = await findOpenAttempt(order.id, providerOrderId);
  if (payment && payment.status !== 'PAID') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED', failureCode: 'USER_CANCELLED',
        failureReason: 'Cancelled by customer before completing payment',
        ipHash: hmacHash(meta.ip), userAgent: meta.userAgent?.slice(0, 500),
      },
    });
  }
  if (order.paymentStatus !== 'PAID') {
    await prisma.qrOrder.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } });
  }

  logger.info({ event: 'qr_payment_cancelled', qrOrderId: order.id, paymentId: payment?.id }, 'QR payment cancelled by customer');
  return { ok: true };
};

/** Full attempt history for one order — shown to the customer on the orders page. */
export const listQrPaymentAttempts = async (userId: string, qrOrderId: string) => {
  const order = await prisma.qrOrder.findUnique({ where: { id: qrOrderId } });
  if (!order || order.userId !== userId) throw NotFound('Order not found');

  const items = await prisma.payment.findMany({
    where:   { qrOrderId: order.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, provider: true, status: true, amount: true, currency: true,
      failureCode: true, failureReason: true, providerPaymentId: true,
      createdAt: true, updatedAt: true,
    },
  });
  return { items };
};

/**
 * Fulfilment timeline for one order — shown to the customer on the orders
 * page. Actor identity is admin-internal, so only status/note/timestamp are
 * exposed here (see admin.service.listQrOrderEvents for the admin version).
 */
export const listMyQrOrderEvents = async (userId: string, qrOrderId: string) => {
  const order = await prisma.qrOrder.findUnique({ where: { id: qrOrderId } });
  if (!order || order.userId !== userId) throw NotFound('Order not found');

  const items = await prisma.qrOrderStatusEvent.findMany({
    where:   { qrOrderId: order.id },
    orderBy: { createdAt: 'asc' },
    select:  { id: true, status: true, note: true, createdAt: true },
  });
  return { items };
};
