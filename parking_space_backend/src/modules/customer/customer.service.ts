/**
 * Customer service — a signed-in customer's own profile + saved spaces.
 */
import type { PaymentServiceType } from '@ps/types';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/http.js';
import { decryptField } from '../../lib/crypto.js';
import type { UpdateProfileInput } from './customer.schema.js';
import { recordDetailChanges } from '../../lib/detailsChangeLog.js';

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, fullName: true, email: true, phone: true,
      avatarUrl: true, emailVerified: true, provider: true,
      createdAt: true, status: true,
    },
  });
  if (!user) throw NotFound('User not found');
  return user;
};

export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const { fullName, phone } = input;
  // phone is @unique — guard against collision with another account.
  if (phone) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw BadRequest('Another account already uses that phone number');
    }
  }
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, phone: true } });
  await recordDetailChanges({
    actorId: userId, entity: 'User', entityId: userId,
    changes: [
      ...(fullName !== undefined ? [{ field: 'accountName', label: 'Account name', from: before?.fullName ?? null, to: fullName }] : []),
      ...(phone !== undefined ? [{ field: 'accountPhone', label: 'Account mobile', from: before?.phone ?? null, to: phone || null }] : []),
    ],
  });
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(phone !== undefined    ? { phone }    : {}),
    },
    select: {
      id: true, fullName: true, email: true, phone: true,
      avatarUrl: true, emailVerified: true, createdAt: true,
    },
  });
};

// Only surface publicly visible saved spaces (approved + active) — a user may
// have saved a space that was later removed/deactivated.
export const listSavedSpaces = async (userId: string) => {
  const rows = await prisma.savedSpace.findMany({
    where: { userId },
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
  return rows
    .map((row) => ({ ...row.location, savedAt: row.savedAt }))
    .filter((l) => l.approvalStatus === 'APPROVED' && l.isActive);
};

export const listSavedSpaceIds = async (userId: string) => {
  const rows = await prisma.savedSpace.findMany({
    where:  { userId },
    select: { locationId: true },
  });
  return rows.map((r) => r.locationId);
};

export const toggleSavedSpace = async (userId: string, locationId: string) => {
  const location = await prisma.parkingLocation.findUnique({
    where: { id: locationId },
    select: { id: true },
  });
  if (!location) throw NotFound('Location not found');

  const existing = await prisma.savedSpace.findUnique({
    where: { userId_locationId: { userId, locationId } },
  });
  if (existing) {
    await prisma.savedSpace.delete({ where: { userId_locationId: { userId, locationId } } });
    return { saved: false };
  }
  await prisma.savedSpace.create({ data: { userId, locationId } });
  return { saved: true };
};

/**
 * Every payment the customer has ever attempted, across services — a
 * Payment row always links to exactly one of Booking / QrOrder (see
 * schema.prisma's Payment model comment), so we just fetch by either
 * relation's userId and discriminate on which one came back non-null.
 * Unpaginated for now (same as listMyBookings / listMyQrOrders) — a
 * customer's own history is small.
 */
export const listMyTransactions = async (userId: string) => {
  const payments = await prisma.payment.findMany({
    where: { OR: [{ booking: { userId } }, { qrOrder: { userId } }] },
    include: {
      booking: {
        include: {
          slot: {
            include: {
              location: { select: { name: true, addressLine: true, city: true, state: true, pincode: true } },
            },
          },
        },
      },
      qrOrder: {
        include: { registration: { select: { plateNumber: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    items: payments.map((p) => {
      const base = {
        id:                p.id,
        provider:          p.provider,
        status:            p.status,
        amount:            Number(p.amount),
        currency:          p.currency,
        providerPaymentId: p.providerPaymentId,
        failureReason:     p.failureReason,
        refundAmount:      p.refundAmount != null ? Number(p.refundAmount) : null,
        refundedAt:        p.refundedAt,
        createdAt:         p.createdAt,
      };

      if (p.booking) {
        const { booking } = p;
        return {
          ...base,
          serviceType: 'SPACE_BOOKING' satisfies PaymentServiceType,
          booking: {
            id:           booking.id,
            reference:    booking.reference,
            status:       booking.status,
            bookingType:  booking.bookingType,
            startAt:      booking.startAt,
            endAt:        booking.endAt,
            slotCode:     booking.slot.code,
            vehicleType:  booking.slot.vehicleType,
            locationName: booking.slot.location.name,
            addressLine:  booking.slot.location.addressLine,
            city:         booking.slot.location.city,
            state:        booking.slot.location.state,
            pincode:      booking.slot.location.pincode,
          },
        };
      }

      if (p.qrOrder) {
        const { qrOrder } = p;
        return {
          ...base,
          serviceType: 'QR_CODE_REGISTRATION' satisfies PaymentServiceType,
          qrOrder: {
            id:           qrOrder.id,
            status:       qrOrder.status,
            plateNumber:  qrOrder.registration ? decryptField(qrOrder.registration.plateNumber) : null,
            shippingName: qrOrder.shippingName,
            city:         qrOrder.city,
            state:        qrOrder.state,
          },
        };
      }

      // Not expected today (every Payment has a booking or a qrOrder), kept
      // as a safe fallback for a future service added before it gets its own branch here.
      return { ...base, serviceType: 'OTHER' satisfies PaymentServiceType };
    }),
  };
};
