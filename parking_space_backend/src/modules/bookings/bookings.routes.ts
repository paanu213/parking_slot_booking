import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Conflict, NotFound } from '../../lib/http.js';

const r = Router();
r.use(requireAuth);

const createSchema = z
  .object({
    slotId: z.string().min(1),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
  })
  .refine((d) => d.endAt > d.startAt, { message: 'endAt must be after startAt' });

// Create a booking with DB-level slot lock to prevent double-booking
r.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const { slotId, startAt, endAt } = req.body as z.infer<typeof createSchema>;
    const userId = req.user!.sub;

    const booking = await prisma.$transaction(async (tx) => {
      // Lock the slot row for the duration of the tx (MySQL InnoDB)
      await tx.$queryRawUnsafe('SELECT id FROM Slot WHERE id = ? FOR UPDATE', slotId);

      const slot = await tx.slot.findUnique({ where: { id: slotId } });
      if (!slot || slot.status !== 'ACTIVE') throw NotFound('Slot unavailable');

      const overlap = await tx.booking.findFirst({
        where: {
          slotId,
          status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });
      if (overlap) throw Conflict('Slot already booked for this window');

      const hours = Math.max(1, Math.ceil((+endAt - +startAt) / 3600_000));
      const totalAmount = Number(slot.hourlyPrice) * hours;
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw BadRequest('Invalid amount');

      return tx.booking.create({
        data: {
          reference: `PS-${nanoid(10).toUpperCase()}`,
          userId,
          slotId,
          startAt,
          endAt,
          totalAmount,
        },
      });
    });

    res.status(201).json(booking);
  } catch (e) {
    next(e);
  }
});

// Current user's bookings
r.get('/mine', async (req, res) => {
  const items = await prisma.booking.findMany({
    where: { userId: req.user!.sub },
    include: { slot: { include: { location: true } }, payments: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

export default r;
