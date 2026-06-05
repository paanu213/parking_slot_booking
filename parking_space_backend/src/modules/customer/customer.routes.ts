/**
 * Customer "me" routes — authenticated endpoints that let a signed-in
 * customer manage their own profile, preferences, and saved spaces.
 *
 * All routes require a valid session (requireAuth middleware).
 * Role check: only CUSTOMER accounts use these endpoints.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http.js';

const r = Router();
r.use(requireAuth);

// ── Profile ──────────────────────────────────────────────────────────────────

r.get('/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true, fullName: true, email: true, phone: true,
        avatarUrl: true, emailVerified: true, provider: true,
        createdAt: true, status: true,
      },
    });
    if (!user) return next(NotFound('User not found'));
    res.json({ user });
  } catch (e) { next(e); }
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  phone:    z.string().min(7).max(20).nullable().optional(),
});

r.patch('/profile', validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { fullName, phone } = req.body as z.infer<typeof updateProfileSchema>;

    // phone is @unique — guard against collision
    if (phone) {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing && existing.id !== req.user!.sub) {
        return next(BadRequest('Another account already uses that phone number'));
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data:  {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(phone !== undefined    ? { phone }    : {}),
      },
      select: {
        id: true, fullName: true, email: true, phone: true,
        avatarUrl: true, emailVerified: true, createdAt: true,
      },
    });
    res.json({ user });
  } catch (e) { next(e); }
});

// ── Saved Spaces ─────────────────────────────────────────────────────────────

/** GET /api/customer/me/saved-spaces — list the signed-in user's saved spaces. */
r.get('/saved-spaces', async (req, res, next) => {
  try {
    const rows = await prisma.savedSpace.findMany({
      where: { userId: req.user!.sub },
      include: {
        location: {
          include: {
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
            slots:  { where: { status: 'ACTIVE' }, take: 1 },
            vendor: { select: { businessName: true, contactPhone: true } },
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    });

    // Only surface publicly visible spaces (approved + active).
    // A user could have saved a space that was later removed/deactivated.
    const locations = rows
      .map((r) => ({ ...r.location, savedAt: r.savedAt }))
      .filter((l) => l.approvalStatus === 'APPROVED' && l.isActive);

    res.json({ items: locations });
  } catch (e) { next(e); }
});

/** GET /api/customer/me/saved-spaces/ids — just the saved location IDs (lightweight, used by the UI to show heart state). */
r.get('/saved-spaces/ids', async (req, res, next) => {
  try {
    const rows = await prisma.savedSpace.findMany({
      where:  { userId: req.user!.sub },
      select: { locationId: true },
    });
    res.json({ ids: rows.map((r) => r.locationId) });
  } catch (e) { next(e); }
});

/** POST /api/customer/me/saved-spaces/:locationId — toggle save/unsave. */
r.post('/saved-spaces/:locationId', async (req, res, next) => {
  try {
    const userId     = req.user!.sub;
    const locationId = req.params.locationId;

    // Verify the location exists
    const location = await prisma.parkingLocation.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) return next(NotFound('Location not found'));

    const existing = await prisma.savedSpace.findUnique({
      where: { userId_locationId: { userId, locationId } },
    });

    if (existing) {
      await prisma.savedSpace.delete({
        where: { userId_locationId: { userId, locationId } },
      });
      res.json({ saved: false });
    } else {
      await prisma.savedSpace.create({
        data: { userId, locationId },
      });
      res.json({ saved: true });
    }
  } catch (e) { next(e); }
});

export default r;
