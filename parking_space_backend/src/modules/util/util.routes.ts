/**
 * Utility endpoints used by the frontends — small helpers that don't belong to
 * any specific domain (pincode lookup proxy, "List your space" lead capture).
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { optionalAuth } from '../../middleware/auth.js';
import { leadSchema } from './util.schema.js';
import { getPincode, submitVendorLead } from './util.controller.js';
import { getStickerPricePaise } from '../../lib/qrPricing.js';

const r = Router();

// GET /api/util/pincode/:pincode → { city, state, area, places[] }
r.get('/pincode/:pincode', getPincode);

// GET /api/util/qr-pricing → { stickerPricePaise } (current price for new QR sticker orders)
r.get('/qr-pricing', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ stickerPricePaise: await getStickerPricePaise() });
  } catch (e) { next(e); }
});

// POST /api/util/vendor-leads → creates a reviewable VendorLead.
// "List your space" (PARKING) requires a signed-in account; the service-partner
// form (SERVICE) still accepts guests. Enforced in the controller.
r.post('/vendor-leads', optionalAuth, validate(leadSchema), submitVendorLead);

export default r;
