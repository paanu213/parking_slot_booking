/**
 * Public location routes — customer-facing search, detail, and availability.
 * No auth (these power the public spaces browsing experience).
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { searchSchema, availabilitySchema } from './locations.schema.js';
import * as ctrl from './locations.controller.js';

const r = Router();

r.get('/', validate(searchSchema, 'query'), ctrl.search);
r.get('/:id', ctrl.getOne);
r.get('/:id/availability', validate(availabilitySchema, 'query'), ctrl.getAvailability);

export default r;
