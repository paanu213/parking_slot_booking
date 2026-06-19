/**
 * Customer service — a signed-in customer's own profile + saved spaces.
 */
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/http.js';
import type { UpdateProfileInput } from './customer.schema.js';

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
