/**
 * Public call routes — mounted alongside scan.routes at /api/c. Placing a
 * call and polling its status need no auth; every real limit (blocklist,
 * silent hours, daily caps) is enforced inside calls.service against the
 * permit-resolved registration, not against the caller's identity.
 */
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { initiateCallSchema } from './calls.schema.js';
import * as ctrl from './calls.controller.js';

const r = Router();

r.post('/call', validate(initiateCallSchema), ctrl.initiate);
r.get('/call/:id/status', ctrl.status);

export default r;
