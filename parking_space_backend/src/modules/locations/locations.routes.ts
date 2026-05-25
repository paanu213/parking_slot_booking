import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http.js';

const r = Router();

const searchSchema = z.object({
  q: z.string().trim().optional(),
  city: z.string().trim().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).default(5),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
});

/**
 * Customers must only see APPROVED + active spaces. Approval is the admin's
 * gate; isActive is the vendor's "publish/unpublish" toggle.
 */
const publicLocationFilter: Prisma.ParkingLocationWhereInput = {
  isActive: true,
  approvalStatus: 'APPROVED',
};

// Public: list/search parking locations
r.get('/', validate(searchSchema, 'query'), async (req, res) => {
  const { q, city, page, pageSize } = req.query as unknown as z.infer<typeof searchSchema>;
  const where: Prisma.ParkingLocationWhereInput = {
    ...publicLocationFilter,
    ...(city ? { city: { equals: city } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { addressLine: { contains: q } },
            { city: { contains: q } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.parkingLocation.findMany({
      where,
      include: {
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
        slots: { where: { status: 'ACTIVE' }, take: 1 },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.parkingLocation.count({ where }),
  ]);
  res.json({ items, total, page, pageSize });
});

// Public: location detail
r.get('/:id', async (req, res, next) => {
  const location = await prisma.parkingLocation.findFirst({
    where: { id: req.params.id, ...publicLocationFilter },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      slots: { where: { status: 'ACTIVE' }, orderBy: { code: 'asc' } },
      vendor: { select: { businessName: true } },
    },
  });
  if (!location) return next(NotFound('Location not found'));
  res.json(location);
});

// Public: availability for a location over a window
const availabilitySchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});

r.get('/:id/availability', validate(availabilitySchema, 'query'), async (req, res, next) => {
  try {
    const { startAt, endAt } = req.query as unknown as z.infer<typeof availabilitySchema>;
    if (endAt <= startAt) return next(BadRequest('endAt must be after startAt'));

    // Ensure the location itself is publicly visible before exposing its slots.
    const location = await prisma.parkingLocation.findFirst({
      where: { id: req.params.id, ...publicLocationFilter },
      select: { id: true },
    });
    if (!location) return next(NotFound('Location not found'));

    const slots = await prisma.slot.findMany({
      where: { locationId: location.id, status: 'ACTIVE' },
      include: {
        bookings: {
          where: {
            status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          select: { id: true },
        },
      },
    });

    const items = slots.map((s) => ({
      id: s.id,
      code: s.code,
      vehicleType: s.vehicleType,
      hourlyPrice: Number(s.hourlyPrice),
      available: s.bookings.length === 0,
    }));
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

export default r;
