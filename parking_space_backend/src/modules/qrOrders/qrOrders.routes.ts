/**
 * "Get your QR sticker" request + payment routes — authenticated. Checkout
 * and verify are rate-limited (real cost on the gateway side, and verify is
 * a signature check worth throttling against brute force).
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { paymentLimiter } from '../../middleware/rateLimit.js';
import {
  createQrOrderSchema, verifyQrPaymentSchema, qrPaymentFailedSchema, qrPaymentCancelSchema,
} from './qrOrders.schema.js';
import * as ctrl from './qrOrders.controller.js';

const r = Router();
r.use(requireAuth);

r.post('/', validate(createQrOrderSchema), ctrl.create);
r.get('/', ctrl.list);
r.get('/:id', ctrl.get);
r.get('/:id/payments', ctrl.paymentHistory);
r.get('/:id/events', ctrl.events);
r.post('/:id/checkout', paymentLimiter, ctrl.checkout);
r.post('/:id/verify', paymentLimiter, validate(verifyQrPaymentSchema), ctrl.verify);
r.post('/:id/payment-failed', paymentLimiter, validate(qrPaymentFailedSchema), ctrl.reportFailed);
r.post('/:id/payment-cancelled', paymentLimiter, validate(qrPaymentCancelSchema), ctrl.reportCancelled);

export default r;
