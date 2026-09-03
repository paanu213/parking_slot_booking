/**
 * "My Vehicles" routes — authenticated owner CRUD for QR Calling registrations.
 * The public scan flow (/c/lookup, /c/call, /c/emergency) is a separate,
 * unauthenticated module added in a later phase.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { registerVehicleSchema, updateVehicleSchema } from './vehicles.schema.js';
import * as ctrl from './vehicles.controller.js';

const r = Router();
r.use(requireAuth);

r.get('/', ctrl.list);
r.post('/', validate(registerVehicleSchema), ctrl.create);
r.get('/:id', ctrl.get);
r.put('/:id', validate(updateVehicleSchema), ctrl.update);
r.patch('/:id/pause', ctrl.pause);
r.patch('/:id/resume', ctrl.resume);
r.delete('/:id', ctrl.remove);
r.get('/:id/calls', ctrl.calls);
r.post('/:id/calls/:callId/block', ctrl.blockCaller);

export default r;
