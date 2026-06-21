/**
 * Payment routes — Razorpay order creation + verification (authenticated).
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createOrderSchema, verifySchema } from './payments.schema.js';
import * as ctrl from './payments.controller.js';

const r = Router();
r.use(requireAuth);

r.post('/create-order', validate(createOrderSchema), ctrl.createOrder);
r.post('/verify', validate(verifySchema), ctrl.verify);

export default r;
