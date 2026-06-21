/**
 * Bookings service — create a booking under a DB-level slot lock (prevents
 * double-booking) and list the signed-in user's own bookings.
 */
import { nanoid } from 'nanoid';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, Conflict, NotFound } from '../../lib/http.js';
import { calculateBookingAmount } from '../../lib/pricing.js';
import { getCommissionRate, commissionFor } from '../../lib/commission.js';
import type { CreateBookingInput } from './bookings.schema.js';

export const createBooking = async (userId: string, input: CreateBookingInput) => {
  const { slotId, bookingType, startAt, endAt } = input;
  const commissionRate = await getCommissionRate();

  return prisma.$transaction(async (tx) => {
    // Lock the slot row for the duration of the tx (MySQL InnoDB).
    await tx.$queryRawUnsafe('SELECT id FROM Slot WHERE id = ? FOR UPDATE', slotId);

    const slot = await tx.slot.findUnique({ where: { id: slotId } });
    if (!slot || slot.status !== 'ACTIVE') throw NotFound('Slot unavailable');

    let calc;
    try {
      calc = calculateBookingAmount({
        bookingType,
        hourlyPrice:  Number(slot.hourlyPrice),
        monthlyPrice: slot.monthlyPrice != null ? Number(slot.monthlyPrice) : null,
        startAt,
        endAt,
      });
    } catch (e: any) {
      throw BadRequest(e?.message ?? 'Could not calculate booking amount');
    }

    const overlap = await tx.booking.findFirst({
      where: {
        slotId,
        status:  { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
        startAt: { lt: calc.endAt },
        endAt:   { gt: calc.startAt },
      },
    });
    if (overlap) throw Conflict('Slot already booked for this window');

    if (!Number.isFinite(calc.amount) || calc.amount <= 0) throw BadRequest('Invalid amount');

    return tx.booking.create({
      data: {
        reference:        `PS-${nanoid(10).toUpperCase()}`,
        userId,
        slotId,
        bookingType,
        startAt:          calc.startAt,
        endAt:            calc.endAt,
        totalAmount:      calc.amount,
        commissionRate,
        commissionAmount: commissionFor(calc.amount, commissionRate),
      },
    });
  });
};

export const listMyBookings = (userId: string) =>
  prisma.booking.findMany({
    where:   { userId },
    include: { slot: { include: { location: true } }, payments: true },
    orderBy: { createdAt: 'desc' },
  });

/**
 * Attach any unclaimed walk-in (direct) bookings made for this email to the
 * account. Called when a customer signs up or logs in, so vendor-created
 * bookings show up in their history. Idempotent and matches case-insensitively
 * (emails are stored lowercased).
 */
export const claimDirectBookings = (userId: string, email: string) =>
  prisma.booking.updateMany({
    where: { isDirectBooking: true, userId: null, guestEmail: email.trim().toLowerCase() },
    data:  { userId },
  });
