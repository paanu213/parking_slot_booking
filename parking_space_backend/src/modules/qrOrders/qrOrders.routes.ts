/**
 * "Get your QR sticker" request routes — authenticated. See qrOrders.service
 * for why this doesn't charge online (payment is paused sitewide).
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createQrOrderSchema } from './qrOrders.schema.js';
import * as ctrl from './qrOrders.controller.js';

const r = Router();
r.use(requireAuth);

r.post('/', validate(createQrOrderSchema), ctrl.create);
r.get('/', ctrl.list);
r.get('/:id', ctrl.get);

export default r;
