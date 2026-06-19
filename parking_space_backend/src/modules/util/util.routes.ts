/**
 * Utility endpoints used by the frontends — small helpers that don't belong to
 * any specific domain (pincode lookup proxy, "List your space" lead capture).
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { leadSchema } from './util.schema.js';
import { getPincode, submitVendorLead } from './util.controller.js';

const r = Router();

// GET /api/util/pincode/:pincode → { city, state, area, places[] }
r.get('/pincode/:pincode', getPincode);

// POST /api/util/vendor-leads → creates a reviewable VendorLead
r.post('/vendor-leads', validate(leadSchema), submitVendorLead);

export default r;
