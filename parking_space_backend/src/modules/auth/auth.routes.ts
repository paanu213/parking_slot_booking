import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import { login, logout, me, refresh, register } from './auth.controller.js';

const r = Router();

r.post('/register', authLimiter, validate(registerSchema), register);
r.post('/login', authLimiter, validate(loginSchema), login);
r.post('/refresh', refresh);
r.post('/logout', logout);
r.get('/me', requireAuth, me);

export default r;
