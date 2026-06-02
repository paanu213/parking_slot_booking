import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/http.js';
import { calculateBookingAmount } from '../../lib/pricing.js';
import { getCommissionRate, commissionFor } from '../../lib/commission.js';
import { deleteImageByUrl, storeImageBuffer } from '../../lib/images.js';
import { imageUpload } from '../uploads/uploads.routes.js';

const r = Router();
r.use(requireAuth, requireRole('VENDOR'));

// Profile
r.get('/me', async (req, res, next) => {
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.user!.sub },
    include: { user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } } },
  });
  if (!vendor) return next(NotFound('Vendor profile not found'));
  res.json(vendor);
});

// User-level fields that live on the User model (not Vendor)
const USER_FIELDS = ['fullName', 'phone', 'email'] as const;
type UserField = typeof USER_FIELDS[number];

const updateProfileSchema = z.object({
  // Owner / User fields
  fullName:     z.string().min(2).max(120).optional(),
  phone:        z.string().max(20).optional(),
  email:        z.string().email().optional(),
  // Vendor fields
  businessName: z.string().min(2).max(120).optional(),
  contactPhone: z.string().min(7).max(20).optional(),
  address:      z.string().min(3).max(255).optional(),
  gstNumber:    z.string().max(32).optional(),
  panNumber:    z.string().max(16).optional(),
  payoutUpiId:  z.string().max(64).optional(),
  aadharNumber: z.string().max(20).nullish(),
  aadharDocUrl: z.union([z.string().url(), z.literal('')]).nullish(),
}).partial();

r.put('/me', validate(updateProfileSchema), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUniqueOrThrow({
      where: { userId: req.user!.sub },
      include: { user: { select: { id: true } } },
    });

    if (vendor.status === 'APPROVED') {
      // Store ALL fields (including user fields) as pending — admin applies them on approval
      await prisma.vendor.update({
        where: { userId: req.user!.sub },
        data: { pendingProfileData: JSON.stringify(req.body) },
      });
    } else {
      // Separate user fields from vendor fields
      const userUpdate: Partial<Record<UserField, string>> = {};
      const vendorUpdate: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(req.body)) {
        if (value === undefined || value === null || value === '') continue;
        if ((USER_FIELDS as readonly string[]).includes(key)) {
          userUpdate[key as UserField] = value as string;
        } else {
          vendorUpdate[key] = value;
        }
      }

      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({ where: { id: vendor.user.id }, data: userUpdate });
      }
      if (Object.keys(vendorUpdate).length > 0) {
        await prisma.vendor.update({ where: { userId: req.user!.sub }, data: vendorUpdate });
      }
    }

    // Return fresh vendor with user
    const updated = await prisma.vendor.findUniqueOrThrow({
      where: { userId: req.user!.sub },
      include: { user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } } },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// Locations CRUD (vendor-scoped)
const locationSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  addressLine: z.string().min(3).max(255),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().min(3).max(12),
  area: z.string().max(100).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const ensureOwnLocation = async (vendorUserId: string, locationId: string) => {
  const loc = await prisma.parkingLocation.findFirst({
    where: { id: locationId, vendor: { userId: vendorUserId } },
  });
  if (!loc) throw Forbidden('Not your location');
  return loc;
};

r.post('/locations', validate(locationSchema), async (req, res) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { userId: req.user!.sub } });
  const loc = await prisma.parkingLocation.create({
    data: { ...req.body, vendorId: vendor.id, isActive: false, approvalStatus: 'PENDING_REVIEW' },
  });
  res.status(201).json(loc);
});

r.get('/locations', async (req, res) => {
  const items = await prisma.parkingLocation.findMany({
    where: { vendor: { userId: req.user!.sub } },
    include: {
      slots: true,
      images: true,
      amenities: { include: { amenity: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

// Delete a location — only allowed while PENDING_REVIEW or REJECTED (not once approved)
r.delete('/locations/:id', async (req, res, next) => {
  try {
    const loc = await ensureOwnLocation(req.user!.sub, req.params.id);
    if (loc.approvalStatus === 'APPROVED') {
      throw BadRequest('Approved spaces cannot be deleted. You can deactivate them instead.');
    }

    // Clean up images from R2
    const images = await prisma.locationImage.findMany({ where: { locationId: loc.id } });
    await Promise.all(images.map((img) => deleteImageByUrl(img.url)));

    // Delete any bookings tied to slots in this location first (Booking.slot has no cascade in DB).
    // Payment rows are cleaned up automatically via Payment→Booking cascade.
    const slots = await prisma.slot.findMany({ where: { locationId: loc.id }, select: { id: true } });
    const slotIds = slots.map((s) => s.id);
    if (slotIds.length > 0) {
      await prisma.booking.deleteMany({ where: { slotId: { in: slotIds } } });
    }

    // Now cascade-delete the location (cascades to Slot, LocationImage, ParkingLocationAmenity)
    await prisma.parkingLocation.delete({ where: { id: loc.id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

r.put('/locations/:id', validate(locationSchema), async (req, res, next) => {
  try {
    const loc = await ensureOwnLocation(req.user!.sub, req.params.id);
    let data: Record<string, unknown>;
    if (loc.approvalStatus === 'APPROVED') {
      // Space is live — store edits as pending, don't overwrite live fields
      data = { pendingData: JSON.stringify(req.body) };
    } else {
      // PENDING_REVIEW or REJECTED — update directly and resubmit for review
      data = { ...req.body, approvalStatus: 'PENDING_REVIEW', approvalNote: null };
    }
    const updated = await prisma.parkingLocation.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Slots
const slotSchema = z.object({
  code: z.string().min(1).max(32),
  vehicleType: z.string().default('FOUR_WHEELER'),
  hourlyPrice: z.number().nonnegative(),
  dailyPrice: z.number().nonnegative().default(0),   // kept for DB compat; UI no longer collects it
  monthlyPrice: z.number().nonnegative().optional(),
});

r.post('/locations/:id/slots', validate(slotSchema), async (req, res, next) => {
  try {
    await ensureOwnLocation(req.user!.sub, req.params.id);
    const slot = await prisma.slot.create({ data: { ...req.body, locationId: req.params.id } });
    res.status(201).json(slot);
  } catch (e) {
    next(e);
  }
});

const slotUpdateSchema = z.object({
  code: z.string().min(1).max(32).optional(),
  vehicleType: z.string().optional(),
  hourlyPrice: z.number().nonnegative().optional(),
  dailyPrice: z.number().nonnegative().optional(),
  monthlyPrice: z.number().nonnegative().optional(),
});

const ensureOwnSlot = async (vendorUserId: string, slotId: string) => {
  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: { location: { include: { vendor: true } } },
  });
  if (!slot || slot.location.vendor.userId !== vendorUserId) throw Forbidden();
  return slot;
};

r.patch('/slots/:slotId', validate(slotUpdateSchema), async (req, res, next) => {
  try {
    const slot = await ensureOwnSlot(req.user!.sub, req.params.slotId);
    const updated = await prisma.slot.update({ where: { id: slot.id }, data: req.body });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

r.patch('/slots/:slotId/status', async (req, res, next) => {
  try {
    const slot = await ensureOwnSlot(req.user!.sub, req.params.slotId);
    const updated = await prisma.slot.update({
      where: { id: slot.id },
      data: { status: req.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// All bookings for one of the vendor's own slots — past, present & future
r.get('/slots/:slotId/bookings', async (req, res, next) => {
  try {
    const owned = await ensureOwnSlot(req.user!.sub, req.params.slotId);

    const slot = await prisma.slot.findUnique({
      where: { id: owned.id },
      include: {
        location: { select: { id: true, name: true, city: true, state: true } },
      },
    });

    const bookings = await prisma.booking.findMany({
      where: { slotId: owned.id },
      include: {
        user:     { select: { fullName: true, email: true, phone: true } },
        payments: { select: { id: true, status: true, amount: true, provider: true, createdAt: true } },
      },
      orderBy: { startAt: 'desc' },
    });

    const revenueBookings = bookings.filter((b) => ['CONFIRMED', 'COMPLETED'].includes(b.status));
    res.json({
      slot,
      bookings,
      stats: {
        total:     bookings.length,
        confirmed: revenueBookings.length,
        cancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
        revenue:   revenueBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0),
      },
    });
  } catch (e) {
    next(e);
  }
});

r.patch('/locations/:id/status', async (req, res, next) => {
  try {
    const loc = await ensureOwnLocation(req.user!.sub, req.params.id);
    if (loc.approvalStatus !== 'APPROVED') throw BadRequest('Only approved spaces can be toggled');
    const updated = await prisma.parkingLocation.update({
      where: { id: req.params.id },
      data: { isActive: Boolean(req.body?.isActive) },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Location images: upload (multipart) + delete
r.post('/locations/:id/images', imageUpload.array('files', 10), async (req, res, next) => {
  try {
    await ensureOwnLocation(req.user!.sub, req.params.id);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw BadRequest('No files uploaded');

    const existing = await prisma.locationImage.count({ where: { locationId: req.params.id } });
    const created = await Promise.all(
      files.map(async (f, i) => {
        const img = await storeImageBuffer(f.buffer);
        return prisma.locationImage.create({
          data: {
            locationId: req.params.id,
            url: img.url,
            width: img.width,
            height: img.height,
            sortOrder: existing + i,
          },
        });
      }),
    );
    res.status(201).json({ items: created });
  } catch (e) {
    next(e);
  }
});

r.delete('/locations/:id/images/:imageId', async (req, res, next) => {
  try {
    await ensureOwnLocation(req.user!.sub, req.params.id);
    const image = await prisma.locationImage.findFirst({
      where: { id: req.params.imageId, locationId: req.params.id },
    });
    if (!image) throw NotFound('Image not found');
    await prisma.locationImage.delete({ where: { id: image.id } });
    await deleteImageByUrl(image.url);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// Amenities — list all admin-managed amenities (vendor reads for selection)
r.get('/amenities', async (_req, res, next) => {
  try {
    const items = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// Set amenities for a location (replaces existing selection)
r.put('/locations/:id/amenities', async (req, res, next) => {
  try {
    await ensureOwnLocation(req.user!.sub, req.params.id);
    const amenityIds: string[] = req.body?.amenityIds ?? [];
    // Replace all: delete existing then insert new
    await prisma.parkingLocationAmenity.deleteMany({
      where: { locationId: req.params.id },
    });
    if (amenityIds.length > 0) {
      await prisma.parkingLocationAmenity.createMany({
        data: amenityIds.map((amenityId: string) => ({
          locationId: req.params.id,
          amenityId,
        })),
        skipDuplicates: true,
      });
    }
    const updated = await prisma.parkingLocation.findUnique({
      where: { id: req.params.id },
      include: { amenities: { include: { amenity: true } } },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Booking history (vendor sees bookings for their slots)
r.get('/bookings', async (req, res) => {
  const items = await prisma.booking.findMany({
    where: { slot: { location: { vendor: { userId: req.user!.sub } } } },
    include: { slot: { include: { location: true } }, user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

// Commission the vendor owes the company — total, paid, pending (+ per-space breakdown)
r.get('/commission/summary', async (req, res, next) => {
  try {
    const due = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        slot:   { location: { vendor: { userId: req.user!.sub } } },
      },
      select: {
        commissionAmount: true,
        commissionStatus: true,
        totalAmount: true,
        slot: { select: { location: { select: { id: true, name: true } } } },
      },
    });

    const totalCommission = due.reduce((s, b) => s + Number(b.commissionAmount), 0);
    const paidCommission  = due.filter((b) => b.commissionStatus === 'PAID')
      .reduce((s, b) => s + Number(b.commissionAmount), 0);

    // Per-space breakdown
    const bySpace = new Map<string, { id: string; name: string; total: number; paid: number; bookings: number }>();
    for (const b of due) {
      const loc = b.slot?.location;
      if (!loc) continue;
      const row = bySpace.get(loc.id) ?? { id: loc.id, name: loc.name, total: 0, paid: 0, bookings: 0 };
      row.total    += Number(b.commissionAmount);
      row.bookings += 1;
      if (b.commissionStatus === 'PAID') row.paid += Number(b.commissionAmount);
      bySpace.set(loc.id, row);
    }

    res.json({
      rate: await getCommissionRate(),
      totalCommission,
      paidCommission,
      pendingCommission: totalCommission - paidCommission,
      bookings: due.length,
      spaces: [...bySpace.values()].map((s) => ({ ...s, pending: s.total - s.paid })),
    });
  } catch (e) {
    next(e);
  }
});

// Direct / offline booking created by vendor on behalf of a walk-in customer
// Supports HOURLY (custom date range) or MONTHLY (30-day pass from startAt).
const directBookingSchema = z
  .object({
    slotId: z.string().min(1),
    guestName: z.string().min(2).max(100),
    guestPhone: z.string().min(7).max(20),
    guestVehicleNumber: z.string().max(20).optional(),
    guestVehicleModel: z.string().max(80).optional(),
    bookingType: z.enum(['HOURLY', 'MONTHLY']).default('HOURLY'),
    startAt: z.coerce.date(),
    endAt: z.coerce.date().optional(), // required for HOURLY; ignored for MONTHLY
    totalAmount: z.number().positive().optional(), // override; auto-calculated if omitted
  })
  .refine(
    (d) => d.bookingType === 'MONTHLY' || (d.endAt && d.endAt > d.startAt),
    { message: 'endAt must be after startAt for hourly bookings' },
  );

r.post('/direct-bookings', validate(directBookingSchema), async (req, res, next) => {
  try {
    const {
      slotId, guestName, guestPhone, guestVehicleNumber, guestVehicleModel,
      bookingType, startAt, endAt, totalAmount,
    } = req.body as z.infer<typeof directBookingSchema>;
    const commissionRate = await getCommissionRate();

    const booking = await prisma.$transaction(async (tx) => {
      // Lock slot row and verify ownership
      await tx.$queryRawUnsafe('SELECT id FROM Slot WHERE id = ? FOR UPDATE', slotId);

      const slot = await tx.slot.findUnique({
        where: { id: slotId },
        include: { location: { include: { vendor: true } } },
      });
      if (!slot || slot.status !== 'ACTIVE') throw BadRequest('Slot is not available');
      if (slot.location.vendor.userId !== req.user!.sub) throw Forbidden('Not your slot');

      // Compute amount + effective window using the shared calculator.
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
          status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
          startAt: { lt: calc.endAt },
          endAt:   { gt: calc.startAt },
        },
      });
      if (overlap) throw Conflict('Slot already booked for this time window');

      const finalAmount = totalAmount ?? calc.amount;

      const { nanoid } = await import('nanoid');
      return tx.booking.create({
        data: {
          reference: `DB-${nanoid(10).toUpperCase()}`,
          slotId,
          userId: null,
          isDirectBooking: true,
          guestName,
          guestPhone,
          guestVehicleNumber: guestVehicleNumber ?? null,
          guestVehicleModel:  guestVehicleModel  ?? null,
          bookingType,
          startAt: calc.startAt,
          endAt:   calc.endAt,
          totalAmount: finalAmount,
          commissionRate,
          commissionAmount: commissionFor(finalAmount, commissionRate),
          status: 'CONFIRMED',
        } as any,
      });
    });

    res.status(201).json(booking);
  } catch (e) {
    next(e);
  }
});

// --- Edit guest info on a direct booking (name, phone, vehicle, dates, booking type) ---
const editGuestSchema = z
  .object({
    guestName:          z.string().min(2).max(100).optional(),
    guestPhone:         z.string().min(7).max(20).optional(),
    guestVehicleNumber: z.string().max(20).optional(),
    guestVehicleModel:  z.string().max(80).optional(),
    bookingType:        z.enum(['HOURLY', 'MONTHLY']).optional(),
    startAt:            z.coerce.date().optional(),
    endAt:              z.coerce.date().optional(), // ignored for MONTHLY
  });

r.patch('/bookings/:id/guest', validate(editGuestSchema), async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { slot: { include: { location: { include: { vendor: true } } } } },
    });
    if (!booking) return next(NotFound('Booking not found'));
    if (!booking.isDirectBooking) return next(BadRequest('Only direct bookings can be edited'));
    if (booking.slot.location.vendor.userId !== req.user!.sub) {
      return next(Forbidden('You do not have access to this booking'));
    }

    const { startAt, endAt, bookingType, ...guestFields } = req.body;

    // Did anything pricing-relevant change?
    const typeChanged  = bookingType && bookingType !== (booking as any).bookingType;
    const datesChanged = !!(startAt || endAt);
    const needsRecalc  = typeChanged || datesChanged;

    let recalc: ReturnType<typeof calculateBookingAmount> | null = null;
    if (needsRecalc) {
      const effectiveType  = (bookingType ?? (booking as any).bookingType ?? 'HOURLY') as 'HOURLY' | 'MONTHLY';
      const effectiveStart = startAt ? new Date(startAt) : booking.startAt;
      const effectiveEnd   = effectiveType === 'MONTHLY'
        ? null
        : (endAt ? new Date(endAt) : booking.endAt);

      try {
        recalc = calculateBookingAmount({
          bookingType:  effectiveType,
          hourlyPrice:  Number(booking.slot.hourlyPrice),
          monthlyPrice: booking.slot.monthlyPrice != null ? Number(booking.slot.monthlyPrice) : null,
          startAt:      effectiveStart,
          endAt:        effectiveEnd,
        });
      } catch (e: any) {
        return next(BadRequest(e?.message ?? 'Could not recalculate booking amount'));
      }
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        ...guestFields,
        ...(bookingType ? { bookingType } : {}),
        ...(recalc ? {
          startAt:          recalc.startAt,
          endAt:            recalc.endAt,
          totalAmount:      recalc.amount,
          commissionAmount: Math.round(recalc.amount * Number(booking.commissionRate)) / 100,
        } : {}),
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// --- Cancel a booking (vendor can only cancel bookings for their own slots) ---
r.patch('/bookings/:id/cancel', async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { slot: { include: { location: { include: { vendor: true } } } } },
    });
    if (!booking) return next(BadRequest('Booking not found'));

    // Ownership check — booking must belong to this vendor's slot
    if (booking.slot.location.vendor.userId !== req.user!.sub) {
      return next(Forbidden('You do not have access to this booking'));
    }

    if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.status)) {
      return next(BadRequest('Only confirmed or pending bookings can be cancelled'));
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        cancelReason: (req.body?.reason as string | undefined) ?? null,
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default r;
