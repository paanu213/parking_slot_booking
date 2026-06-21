/**
 * Booking routes — authenticated customer booking creation + own-bookings list.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createBookingSchema } from './bookings.schema.js';
import * as ctrl from './bookings.controller.js';

const r = Router();
r.use(requireAuth);

r.post('/', validate(createBookingSchema), ctrl.create);
r.get('/mine', ctrl.listMine);

export default r;
