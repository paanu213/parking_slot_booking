/**
 * Customer "me" routes — authenticated endpoints for a signed-in customer to
 * manage their own profile and saved spaces. All require a valid session.
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateProfileSchema } from './customer.schema.js';
import * as ctrl from './customer.controller.js';

const r = Router();
r.use(requireAuth);

r.get('/profile', ctrl.getProfile);
r.patch('/profile', validate(updateProfileSchema), ctrl.updateProfile);

r.get('/saved-spaces', ctrl.getSavedSpaces);
r.get('/saved-spaces/ids', ctrl.getSavedSpaceIds);
r.post('/saved-spaces/:locationId', ctrl.toggleSavedSpace);

r.get('/transactions', ctrl.getTransactions);

export default r;
