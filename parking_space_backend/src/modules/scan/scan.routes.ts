/**
 * Public scan routes — the "/c" flow a stranger hits after scanning a
 * sticker. No auth. Mounted at /api/c.
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { scanLookupLimiter } from '../../middleware/rateLimit.js';
import { lookupSchema, emergencyQuerySchema } from './scan.schema.js';
import * as ctrl from './scan.controller.js';

const r = Router();

r.post('/lookup', scanLookupLimiter, validate(lookupSchema), ctrl.lookup);
r.get('/emergency', validate(emergencyQuerySchema, 'query'), ctrl.emergency);
// POST /call and GET /call/:id/status live in ../calls (calls.routes.ts),
// mounted alongside this router at the same /api/c prefix.

export default r;
