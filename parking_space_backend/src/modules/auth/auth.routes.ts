import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import { login, logout, me, refresh, register } from './auth.controller.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { BadRequest } from '../../lib/http.js';

const r = Router();

r.post('/register', authLimiter, validate(registerSchema), register);
r.post('/login', authLimiter, validate(loginSchema), login);
r.post('/refresh', refresh);
r.post('/logout', logout);
r.get('/me', requireAuth, me);

// Update own profile (name / phone)
const updateMeSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  phone:    z.string().min(7).max(20).nullable().optional(),
});

r.patch('/me', requireAuth, validate(updateMeSchema), async (req, res, next) => {
  try {
    // Phone is @unique — guard against collisions for a friendlier error
    if (req.body.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: req.body.phone } });
      if (existing && existing.id !== req.user!.sub) {
        throw BadRequest('Another account already uses that phone number');
      }
    }
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data:  req.body,
      select: { id: true, email: true, fullName: true, role: true, phone: true, avatarUrl: true },
    });
    res.json({ user });
  } catch (e) { next(e); }
});

// Change own password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8).max(72),
});

r.post('/change-password', requireAuth, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user || !user.passwordHash) throw BadRequest('Password change is not available for this account');

    const ok = await verifyPassword(user.passwordHash, currentPassword);
    if (!ok) throw BadRequest('Current password is incorrect');

    await prisma.user.update({
      where: { id: req.user!.sub },
      data:  { passwordHash: await hashPassword(newPassword) },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
