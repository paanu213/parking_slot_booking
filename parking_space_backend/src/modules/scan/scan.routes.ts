/**
 * Public scan routes — the "/c" flow a stranger hits after scanning a
 * sticker. Mounted at /api/c.
 *
 *  - /lookup                 : type the full plate  (fallback, damaged sticker)
 *  - /t/:token               : resolve a unique sticker (rate-limited — this is
 *                              the endpoint a token-guessing script would probe)
 *  - /t/:token/configure     : owner first-scan setup   (auth required)
 *  - /t/:token/verify        : passer-by enters last-4  (rate-limited)
 *  - /emergency              : ICE card — auth required + permit + the
 *                              scanner's own mobile number (same gate as a call)
 *
 * POST /call and GET /call/:id/status live in ../calls, mounted at the same
 * /api/c prefix.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { scanLookupLimiter } from '../../middleware/rateLimit.js';
import { lookupSchema, revealEmergencySchema, configureStickerSchema, verifyPlateSchema } from './scan.schema.js';
import * as ctrl from './scan.controller.js';

const r = Router();

r.post('/lookup', scanLookupLimiter, validate(lookupSchema), ctrl.lookup);
r.post('/emergency', requireAuth, scanLookupLimiter, validate(revealEmergencySchema), ctrl.emergency);

r.get('/t/:token', scanLookupLimiter, ctrl.stickerState);
r.post('/t/:token/configure', requireAuth, validate(configureStickerSchema), ctrl.configureSticker);
r.post('/t/:token/verify', scanLookupLimiter, validate(verifyPlateSchema), ctrl.verifyStickerPlate);

export default r;
