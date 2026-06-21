/**
 * Locations service — public (customer-facing) parking-space search, detail,
 * and availability.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/http.js';
import type { SearchInput } from './locations.schema.js';

/**
 * Customers must only see APPROVED + active spaces. Approval is the admin's
 * gate; isActive is the vendor's "publish/unpublish" toggle.
 */
const publicLocationFilter: Prisma.ParkingLocationWhereInput = {
  isActive:       true,
  approvalStatus: 'APPROVED',
};

export const searchLocations = async (input: SearchInput) => {
  const { q, city, area, page, pageSize } = input;

  const where: Prisma.ParkingLocationWhereInput = {
    ...publicLocationFilter,
    ...(city ? { city: { equals: city } } : {}),
    ...(area ? { area: { contains: area } } : {}),
    ...(q
      ? {
          OR: [
            { name:        { contains: q } },
            { addressLine: { contains: q } },
            { city:        { contains: q } },
            { area:        { contains: q } },
          ],
        }
      : {}),
  };

  // Areas list — within the current city scope (ignoring the area filter itself
  // so picking an area doesn't shrink the dropdown).
  const areasWhere: Prisma.ParkingLocationWhereInput = {
    ...publicLocationFilter,
    ...(city ? { city: { equals: city } } : {}),
    area: { not: null },
  };

  const [items, total] = await Promise.all([
    prisma.parkingLocation.findMany({
      where,
      include: {
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
        slots:  { where: { status: 'ACTIVE' }, take: 1 },
      },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.parkingLocation.count({ where }),
  ]);

  // Dedup in JS — Prisma `distinct + orderBy + select` has surfaced MySQL engine
  // quirks. Wrapped so an areas failure can't take down the spaces grid.
  let areas: string[] = [];
  try {
    const rows = await prisma.parkingLocation.findMany({ where: areasWhere, select: { area: true } });
    areas = [
      ...new Set(rows.map((row) => row.area).filter((a): a is string => Boolean(a && a.trim()))),
    ].sort();
  } catch {
    areas = [];
  }

  return { items, total, page, pageSize, areas };
};

export const getLocation = async (id: string) => {
  const location = await prisma.parkingLocation.findFirst({
    where: { id, ...publicLocationFilter },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      slots:  { where: { status: 'ACTIVE' }, orderBy: { code: 'asc' } },
      vendor: { select: { businessName: true, contactPhone: true } },
    },
  });
  if (!location) throw NotFound('Location not found');
  return location;
};

export const getAvailability = async (id: string, startAt: Date, endAt: Date) => {
  if (endAt <= startAt) throw BadRequest('endAt must be after startAt');

  // Ensure the location itself is publicly visible before exposing its slots.
  const location = await prisma.parkingLocation.findFirst({
    where:  { id, ...publicLocationFilter },
    select: { id: true },
  });
  if (!location) throw NotFound('Location not found');

  const slots = await prisma.slot.findMany({
    where: { locationId: location.id, status: 'ACTIVE' },
    include: {
      bookings: {
        where: {
          status:  { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
          startAt: { lt: endAt },
          endAt:   { gt: startAt },
        },
        select: { id: true },
      },
    },
  });

  return slots.map((s) => ({
    id:          s.id,
    code:        s.code,
    vehicleType: s.vehicleType,
    hourlyPrice: Number(s.hourlyPrice),
    available:   s.bookings.length === 0,
  }));
};
