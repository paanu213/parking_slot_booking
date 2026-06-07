import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { hashPassword } from '../../lib/password.js';
import { BadRequest, NotFound } from '../../lib/http.js';
import { calculateBookingAmount } from '../../lib/pricing.js';
import { getCommissionRate, setCommissionRate } from '../../lib/commission.js';
import { resolveDateRange } from '../../lib/dateRange.js';
import { storeIconBuffer, storeImageBuffer, deleteImageByUrl, storeDocumentBuffer, deleteDocumentByUrl } from '../../lib/images.js';
import { imageUpload, docUpload } from '../uploads/uploads.routes.js';

const r = Router();
r.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'));

// --- Dashboard stats ---
r.get('/stats', async (req, res, next) => {
  try {
    // Range window — defaults to today if no params supplied
    const now = new Date();
    const defaultStart = new Date(now); defaultStart.setHours(0,  0,  0,   0);
    const defaultEnd   = new Date(now); defaultEnd.setHours(23, 59, 59, 999);

    const rangeStart: Date = req.query.start
      ? new Date(req.query.start as string)
      : defaultStart;
    const rangeEnd: Date = req.query.end
      ? new Date(req.query.end as string)
      : defaultEnd;

    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      return next(BadRequest('Invalid start or end date'));
    }

    const rangeCond = { gte: rangeStart, lte: rangeEnd };

    const [
      // Static / global counts
      totalVendors, pendingVendors, approvedVendors,
      pendingProfileEdits,
      totalSpaces, pendingSpaces, approvedSpaces,
      // Range-filtered metrics
      rangeBookingsTotal,
      rangeBookingsConfirmed,
      rangeBookingsCancelled,
      rangeRevenueResult,
      // Recent lists for pending-action panels
      recentBookings,
      recentPendingVendors,
      recentPendingSpaces,
      recentProfileEdits,
    ] = await prisma.$transaction([
      prisma.vendor.count(),
      prisma.vendor.count({ where: { status: 'PENDING' } }),
      prisma.vendor.count({ where: { status: 'APPROVED' } }),
      prisma.vendor.count({ where: { pendingProfileData: { not: null } } }),
      prisma.parkingLocation.count(),
      prisma.parkingLocation.count({ where: { approvalStatus: 'PENDING_REVIEW' } }),
      prisma.parkingLocation.count({ where: { approvalStatus: 'APPROVED', isActive: true } }),
      // Range bookings
      prisma.booking.count({ where: { createdAt: rangeCond } }),
      prisma.booking.count({ where: { status: 'CONFIRMED', createdAt: rangeCond } }),
      prisma.booking.count({ where: { status: 'CANCELLED', createdAt: rangeCond } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', createdAt: rangeCond },
      }),
      // Recent panels (always last 6/5, not range-filtered)
      prisma.booking.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, email: true } },
          slot: { include: { location: { select: { name: true, city: true } } } },
        },
      }),
      prisma.vendor.findMany({
        where: { status: 'PENDING' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
      }),
      prisma.parkingLocation.findMany({
        where: { approvalStatus: 'PENDING_REVIEW' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { vendor: { select: { businessName: true } } },
      }),
      prisma.vendor.findMany({
        where: { pendingProfileData: { not: null } },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        include: { user: { select: { fullName: true, email: true } } },
      }),
    ]);

    res.json({
      vendors: { total: totalVendors, pending: pendingVendors, approved: approvedVendors, pendingProfileEdits },
      spaces:  { total: totalSpaces,  pending: pendingSpaces,  approved: approvedSpaces  },
      range: {
        bookings:  rangeBookingsTotal,
        confirmed: rangeBookingsConfirmed,
        cancelled: rangeBookingsCancelled,
        revenue:   Number(rangeRevenueResult._sum.amount ?? 0),
      },
      recent: {
        bookings:       recentBookings,
        pendingVendors: recentPendingVendors,
        pendingSpaces:  recentPendingSpaces,
        profileEdits:   recentProfileEdits,
      },
    });
  } catch (e) {
    next(e);
  }
});

// --- Vendor approval flow ---
r.get('/vendors', async (req, res) => {
  const status = (req.query.status as string | undefined) ?? undefined;
  const items = await prisma.vendor.findMany({
    where: status ? { status: status as any } : {},
    include: {
      user: { select: { fullName: true, email: true, phone: true, status: true } },
      // Lightweight location data — used by admin UI for state/city filters.
      locations: { select: { state: true, city: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

// Single vendor — full details (used by admin Vendor Details page)
r.get('/vendors/:id', async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true, fullName: true, email: true, phone: true,
            status: true, createdAt: true, emailVerified: true,
          },
        },
        locations: {
          include: {
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
            slots:  {
              select: {
                id: true, code: true, vehicleType: true,
                hourlyPrice: true, monthlyPrice: true, status: true,
              },
            },
            amenities: { include: { amenity: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Aggregate booking + revenue stats across all the vendor's spaces
    const locationIds = vendor.locations.map((l) => l.id);
    const [bookingsTotal, bookingsConfirmed, bookingsCancelled, revenue, recentBookings] = await Promise.all([
      locationIds.length
        ? prisma.booking.count({ where: { slot: { locationId: { in: locationIds } } } })
        : 0,
      locationIds.length
        ? prisma.booking.count({
            where: { slot: { locationId: { in: locationIds } }, status: 'CONFIRMED' },
          })
        : 0,
      locationIds.length
        ? prisma.booking.count({
            where: { slot: { locationId: { in: locationIds } }, status: 'CANCELLED' },
          })
        : 0,
      locationIds.length
        ? prisma.booking.aggregate({
            _sum: { totalAmount: true },
            where: { slot: { locationId: { in: locationIds } }, status: 'CONFIRMED' },
          })
        : { _sum: { totalAmount: 0 } },
      locationIds.length
        ? prisma.booking.findMany({
            where: { slot: { locationId: { in: locationIds } } },
            include: {
              user: { select: { id: true, fullName: true, email: true, phone: true } },
              slot: {
                select: {
                  id: true, code: true, vehicleType: true,
                  location: { select: { id: true, name: true, city: true } },
                },
              },
              payments: { select: { status: true, amount: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : [],
    ]);

    // Commission generated per space (only CONFIRMED/COMPLETED count as owed)
    const commissionRows = locationIds.length
      ? await prisma.booking.findMany({
          where: { slot: { locationId: { in: locationIds } }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
          select: {
            commissionAmount: true,
            commissionStatus: true,
            slot: { select: { locationId: true } },
          },
        })
      : [];

    const commissionBySpace = new Map<string, { total: number; paid: number }>();
    let commissionTotal = 0;
    let commissionPaid  = 0;
    for (const b of commissionRows) {
      const amt = Number(b.commissionAmount);
      commissionTotal += amt;
      if (b.commissionStatus === 'PAID') commissionPaid += amt;
      const locId = b.slot?.locationId;
      if (!locId) continue;
      const row = commissionBySpace.get(locId) ?? { total: 0, paid: 0 };
      row.total += amt;
      if (b.commissionStatus === 'PAID') row.paid += amt;
      commissionBySpace.set(locId, row);
    }

    // Resolve the admin users behind createdById / approvedById / deactivatedById
    // so the UI can show "created by <admin>" rather than a raw id.
    const adminIds = [vendor.createdById, vendor.approvedById, vendor.deactivatedById].filter(
      (id): id is string => Boolean(id),
    );
    const adminUsers = adminIds.length
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(new Set(adminIds)) } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const adminById = new Map(adminUsers.map((u) => [u.id, u]));
    const origin = {
      createdVia:     vendor.createdVia,
      createdAt:      vendor.createdAt,
      createdBy:      vendor.createdById ? adminById.get(vendor.createdById) ?? null : null,
      approvedAt:     vendor.approvedAt,
      approvedBy:     vendor.approvedById ? adminById.get(vendor.approvedById) ?? null : null,
      deactivatedAt:  vendor.deactivatedAt,
      deactivatedBy:  vendor.deactivatedById ? adminById.get(vendor.deactivatedById) ?? null : null,
    };

    res.json({
      vendor,
      origin,
      stats: {
        spaces:            vendor.locations.length,
        slots:             vendor.locations.reduce((sum, l) => sum + l.slots.length, 0),
        bookingsTotal,
        bookingsConfirmed,
        bookingsCancelled,
        revenue:           Number(revenue._sum.totalAmount ?? 0),
        commissionTotal,
        commissionPaid,
        commissionPending: commissionTotal - commissionPaid,
      },
      // Per-space commission breakdown — keyed by location id
      commissionBySpace: vendor.locations.map((l) => {
        const row = commissionBySpace.get(l.id) ?? { total: 0, paid: 0 };
        return {
          locationId: l.id,
          name:       l.name,
          city:       l.city,
          total:      row.total,
          paid:       row.paid,
          pending:    row.total - row.paid,
        };
      }),
      // Most-recent bookings across this vendor's slots (up to 50, newest first)
      bookings: recentBookings,
    });
  } catch (e) {
    next(e);
  }
});

// Commission owed by a single vendor, filtered by a date range
// (?period=day|month|year|fy|custom[&from&to]). Default = current month.
r.get('/vendors/:id/commission', async (req, res, next) => {
  try {
    const range = resolveDateRange(
      req.query.period as string | undefined,
      req.query.from   as string | undefined,
      req.query.to     as string | undefined,
    );
    const rows = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        slot:   { location: { vendor: { id: req.params.id } } },
        ...(range ? { createdAt: range } : {}),
      },
      select: {
        commissionAmount: true,
        commissionStatus: true,
        slot: { select: { location: { select: { id: true, name: true, city: true } } } },
      },
    });

    const bySpace = new Map<string, { locationId: string; name: string; city: string; total: number; paid: number }>();
    let total = 0;
    let paid  = 0;
    for (const b of rows) {
      const amt = Number(b.commissionAmount);
      total += amt;
      if (b.commissionStatus === 'PAID') paid += amt;
      const loc = b.slot?.location;
      if (!loc) continue;
      const row = bySpace.get(loc.id) ?? { locationId: loc.id, name: loc.name, city: loc.city, total: 0, paid: 0 };
      row.total += amt;
      if (b.commissionStatus === 'PAID') row.paid += amt;
      bySpace.set(loc.id, row);
    }

    res.json({
      total,
      paid,
      pending: total - paid,
      bookings: rows.length,
      bySpace: [...bySpace.values()].map((s) => ({ ...s, pending: s.total - s.paid })),
    });
  } catch (e) {
    next(e);
  }
});

r.post('/vendors/:id/approve', async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: req.user!.sub },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'VENDOR_APPROVE', entity: 'Vendor', entityId: vendor.id },
    });
    res.json(vendor);
  } catch (e) {
    next(e);
  }
});

r.post('/vendors/:id/reject', async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        rejectionNote: req.body?.note ?? null,
        rejectedAt: new Date(),
        rejectedById: req.user!.sub,
      },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'VENDOR_REJECT', entity: 'Vendor', entityId: vendor.id },
    });
    res.json(vendor);
  } catch (e) {
    next(e);
  }
});

r.patch('/vendors/:id/status', async (req, res, next) => {
  try {
    // Narrow to the literal union — without `as const`, TS widens to `string`
    // and Prisma rejects it as not assignable to `VendorStatus`.
    const status = (req.body?.status === 'INACTIVE' ? 'INACTIVE' : 'APPROVED') as 'INACTIVE' | 'APPROVED';
    // Stamp deactivation timestamp when moving INACTIVE; clear it when reactivating.
    const data =
      status === 'INACTIVE'
        ? { status, deactivatedAt: new Date(), deactivatedById: req.user!.sub }
        : { status, deactivatedAt: null, deactivatedById: null };
    const vendor = await prisma.vendor.update({ where: { id: req.params.id }, data });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action: status === 'INACTIVE' ? 'VENDOR_DEACTIVATE' : 'VENDOR_REACTIVATE',
        entity: 'Vendor',
        entityId: vendor.id,
      },
    });
    res.json(vendor);
  } catch (e) {
    next(e);
  }
});

// Edit vendor details
const updateVendorSchema = z.object({
  // Vendor-level fields
  businessName: z.string().min(2).optional(),
  contactPhone: z.string().min(7).optional(),
  address:      z.string().min(3).optional(),
  aadharNumber: z.string().max(20).optional(),
  aadharDocUrl: z.string().url().optional(),
  // Owner / User-level fields
  fullName:     z.string().min(2).optional(),
  phone:        z.string().optional(),
  email:        z.string().email().optional(),
});

r.patch('/vendors/:id', validate(updateVendorSchema), async (req, res, next) => {
  try {
    const { fullName, phone, email, ...vendorData } = req.body as z.infer<typeof updateVendorSchema>;

    // Find current vendor to get userId and check old aadhar doc
    const current = await prisma.vendor.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { user: { select: { id: true } } },
    });

    // Clean up old aadhar doc if being replaced
    if (vendorData.aadharDocUrl && current.aadharDocUrl && current.aadharDocUrl !== vendorData.aadharDocUrl) {
      await deleteDocumentByUrl(current.aadharDocUrl);
    }

    // Update User-level fields (fullName, phone, email) if provided
    if (fullName !== undefined || phone !== undefined || email !== undefined) {
      const userUpdate: Record<string, string> = {};
      if (fullName !== undefined) userUpdate.fullName = fullName;
      if (phone    !== undefined) userUpdate.phone    = phone;
      if (email    !== undefined) userUpdate.email    = email;
      await prisma.user.update({ where: { id: current.user.id }, data: userUpdate });
    }

    // An admin uploading the doc directly counts as verified immediately.
    const verifyStamp = vendorData.aadharDocUrl
      ? { aadharVerifiedAt: new Date(), aadharVerifiedById: req.user!.sub }
      : {};
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data:  { ...vendorData, ...verifyStamp },
      include: { user: { select: { fullName: true, email: true, phone: true, status: true } } },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'VENDOR_EDIT', entity: 'Vendor', entityId: vendor.id },
    });
    res.json(vendor);
  } catch (e) {
    next(e);
  }
});

// Approve a vendor-submitted Aadhaar doc (marks it verified).
r.post('/vendors/:id/aadhaar/approve', async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: req.params.id } });
    if (!vendor.aadharDocUrl) throw BadRequest('No Aadhaar document to verify');
    const updated = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { aadharVerifiedAt: new Date(), aadharVerifiedById: req.user!.sub },
      include: { user: { select: { fullName: true, email: true, phone: true, status: true } } },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'VENDOR_AADHAAR_APPROVE', entity: 'Vendor', entityId: updated.id },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Reject a vendor-submitted Aadhaar doc — removes it so the vendor must re-upload.
r.post('/vendors/:id/aadhaar/reject', async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: req.params.id } });
    if (vendor.aadharDocUrl) await deleteDocumentByUrl(vendor.aadharDocUrl).catch(() => {});
    const updated = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { aadharDocUrl: null, aadharVerifiedAt: null, aadharVerifiedById: null },
      include: { user: { select: { fullName: true, email: true, phone: true, status: true } } },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'VENDOR_AADHAAR_REJECT', entity: 'Vendor', entityId: updated.id },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// --- Create vendor (admin action) ---
const createVendorSchema = z.object({
  email:        z.string().email(),
  fullName:     z.string().min(2),
  phone:        z.string().optional(),
  businessName: z.string().min(2),
  contactPhone: z.string().min(7),
  address:      z.string().min(3),
  aadharNumber: z.string().max(20).optional(),
  aadharDocUrl: z.string().url().optional(),
  tempPassword: z.string().min(8),
});

r.post('/vendors', validate(createVendorSchema), async (req, res) => {
  const { email, fullName, phone, businessName, contactPhone, address, aadharNumber, aadharDocUrl, tempPassword } =
    req.body as z.infer<typeof createVendorSchema>;
  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      phone,
      role: 'VENDOR',
      passwordHash: await hashPassword(tempPassword),
      vendor: {
        create: {
          businessName, contactPhone, address,
          aadharNumber: aadharNumber ?? null,
          aadharDocUrl: aadharDocUrl ?? null,
          // Admin-provided doc at creation is auto-verified.
          aadharVerifiedAt:   aadharDocUrl ? new Date() : null,
          aadharVerifiedById: aadharDocUrl ? req.user!.sub : null,
          status: 'APPROVED', approvedAt: new Date(),
          createdVia: 'ADMIN', createdById: req.user!.sub,
        },
      },
    },
    include: { vendor: true },
  });
  res.status(201).json(user);
});

// --- Vendor profile edit approval (vendor-submitted pending edits) ---
const VENDOR_USER_FIELDS = new Set(['fullName', 'phone', 'email']);

r.post('/vendors/:id/approve-profile', async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { user: { select: { id: true } } },
    });
    if (!vendor.pendingProfileData) return next(BadRequest('No pending profile edits to approve'));
    const pending = JSON.parse(vendor.pendingProfileData) as Record<string, unknown>;

    // Delete old aadhar doc if being replaced by the pending edit
    if (pending.aadharDocUrl && vendor.aadharDocUrl && pending.aadharDocUrl !== vendor.aadharDocUrl) {
      await deleteDocumentByUrl(vendor.aadharDocUrl);
    }

    // Separate user-level fields from vendor-level fields
    const userUpdate: Record<string, unknown> = {};
    const vendorUpdate: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(pending)) {
      if (VENDOR_USER_FIELDS.has(key)) userUpdate[key] = value;
      else vendorUpdate[key] = value;
    }

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: vendor.user.id }, data: userUpdate });
    }

    // Approving a profile edit that includes a (new) Aadhaar doc verifies it.
    const verifyStamp = vendorUpdate.aadharDocUrl
      ? { aadharVerifiedAt: new Date(), aadharVerifiedById: req.user!.sub }
      : {};

    const updated = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { ...vendorUpdate, ...verifyStamp, pendingProfileData: null },
      include: { user: { select: { fullName: true, email: true, phone: true, status: true } } },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'VENDOR_PROFILE_APPROVE', entity: 'Vendor', entityId: vendor.id },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

r.post('/vendors/:id/reject-profile', async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: req.params.id } });
    if (vendor.pendingProfileData) {
      const pending = JSON.parse(vendor.pendingProfileData) as Record<string, unknown>;
      // Delete the newly uploaded aadhar doc (if any) since it won't be used
      if (pending.aadharDocUrl && pending.aadharDocUrl !== vendor.aadharDocUrl) {
        await deleteDocumentByUrl(pending.aadharDocUrl as string);
      }
    }
    const updated = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { pendingProfileData: null, rejectionNote: req.body?.note ?? null },
      include: { user: { select: { fullName: true, email: true, phone: true, status: true } } },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'VENDOR_PROFILE_REJECT', entity: 'Vendor', entityId: vendor.id },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// --- Parking space approval flow ---

// Single space — full detail (for admin edit page)
r.get('/spaces/:id', async (req, res, next) => {
  try {
    const space = await prisma.parkingLocation.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        vendor: { include: { user: { select: { fullName: true, email: true } } } },
        images: { orderBy: { sortOrder: 'asc' } },
        slots:  { orderBy: { createdAt: 'asc' } },
        amenities: { include: { amenity: true } },
      },
    });
    res.json(space);
  } catch (e) {
    next(e);
  }
});

// Single space — enriched detail for the admin Space Details page.
// Space + vendor + aggregate booking / revenue / commission stats + recent history.
r.get('/spaces/:id/details', async (req, res, next) => {
  try {
    const space = await prisma.parkingLocation.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        vendor: { include: { user: { select: { fullName: true, email: true, phone: true, status: true } } } },
        images: { orderBy: { sortOrder: 'asc' } },
        slots:  { orderBy: { createdAt: 'asc' } },
        amenities: { include: { amenity: true } },
      },
    });

    const slotFilter = { slot: { locationId: space.id } } as const;
    const [bookingsTotal, bookingsConfirmed, bookingsCancelled, revenueAgg, commissionRows, recentBookings] =
      await Promise.all([
        prisma.booking.count({ where: slotFilter }),
        prisma.booking.count({ where: { ...slotFilter, status: 'CONFIRMED' } }),
        prisma.booking.count({ where: { ...slotFilter, status: 'CANCELLED' } }),
        prisma.booking.aggregate({
          _sum: { totalAmount: true },
          where: { ...slotFilter, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        }),
        prisma.booking.findMany({
          where: { ...slotFilter, status: { in: ['CONFIRMED', 'COMPLETED'] } },
          select: { commissionAmount: true, commissionStatus: true },
        }),
        prisma.booking.findMany({
          where: slotFilter,
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
            slot: { select: { id: true, code: true, vehicleType: true } },
            payments: { select: { status: true, amount: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    let commissionTotal = 0;
    let commissionPaid  = 0;
    for (const b of commissionRows) {
      const amt = Number(b.commissionAmount);
      commissionTotal += amt;
      if (b.commissionStatus === 'PAID') commissionPaid += amt;
    }

    res.json({
      space,
      stats: {
        slots:             space.slots.length,
        bookingsTotal,
        bookingsConfirmed,
        bookingsCancelled,
        revenue:           Number(revenueAgg._sum.totalAmount ?? 0),
        commissionTotal,
        commissionPaid,
        commissionPending: commissionTotal - commissionPaid,
      },
      bookings: recentBookings,
    });
  } catch (e) {
    next(e);
  }
});

r.get('/spaces', async (req, res) => {
  const status   = req.query.status   as string | undefined;
  const vendorId = req.query.vendorId as string | undefined;

  const where: Record<string, unknown> = {};
  if (status)   where.approvalStatus = status;
  if (vendorId) where.vendorId       = vendorId;

  const items = await prisma.parkingLocation.findMany({
    where,
    include: {
      vendor: { include: { user: { select: { fullName: true, email: true } } } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      slots: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

r.post('/spaces/:id/approve', async (req, res, next) => {
  try {
    const space = await prisma.parkingLocation.findUniqueOrThrow({ where: { id: req.params.id } });
    const pendingEdits = space.pendingData ? (JSON.parse(space.pendingData) as Record<string, unknown>) : null;
    const updated = await prisma.parkingLocation.update({
      where: { id: req.params.id },
      data: {
        ...(pendingEdits ?? {}),
        approvalStatus: 'APPROVED',
        approvalNote: null,
        pendingData: null,
        isActive: true,
        approvedAt: new Date(),
        approvedById: req.user!.sub,
      },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'SPACE_APPROVE', entity: 'ParkingLocation', entityId: updated.id },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

r.post('/spaces/:id/reject', async (req, res, next) => {
  try {
    const updated = await prisma.parkingLocation.update({
      where: { id: req.params.id },
      data: {
        approvalStatus: 'REJECTED',
        approvalNote: req.body?.note ?? null,
        pendingData: null,
        isActive: false,
      },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'SPACE_REJECT', entity: 'ParkingLocation', entityId: updated.id },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Reject only the pending edits on an already-approved space (keeps it live)
r.post('/spaces/:id/reject-edits', async (req, res, next) => {
  try {
    const updated = await prisma.parkingLocation.update({
      where: { id: req.params.id },
      data: { pendingData: null, approvalNote: req.body?.note ?? null },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'SPACE_REJECT_EDITS', entity: 'ParkingLocation', entityId: updated.id },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Admin direct edit of a space's details
const updateSpaceSchema = z.object({
  name:        z.string().min(2).optional(),
  description: z.string().optional(),
  addressLine: z.string().min(3).optional(),
  landmark:    z.string().max(160).nullish(),
  city:        z.string().min(2).optional(),
  state:       z.string().min(2).optional(),
  pincode:     z.string().length(6).optional(),
  latitude:    z.coerce.number().optional(),
  longitude:   z.coerce.number().optional(),
});

r.patch('/spaces/:id', validate(updateSpaceSchema), async (req, res, next) => {
  try {
    const updated = await prisma.parkingLocation.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        vendor: { include: { user: { select: { fullName: true, email: true } } } },
        slots: true,
      },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'SPACE_EDIT', entity: 'ParkingLocation', entityId: updated.id },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// --- Admin: create a parking space for any approved vendor (auto-approved) ---
const createLocationSchema = z.object({
  vendorId:    z.string().min(1),
  name:        z.string().min(2),
  addressLine: z.string().min(3),
  landmark:    z.string().max(160).optional(),
  city:        z.string().min(2),
  state:       z.string().min(2),
  pincode:     z.string().length(6),
  area:        z.string().max(100).optional(),
  latitude:    z.coerce.number(),
  longitude:   z.coerce.number(),
  description: z.string().optional(),
});

r.post('/locations', validate(createLocationSchema), async (req, res, next) => {
  try {
    const { vendorId, ...locationData } = req.body;
    const loc = await prisma.parkingLocation.create({
      data: {
        ...locationData,
        vendorId,
        approvalStatus: 'APPROVED',
        isActive: true,
        approvedAt:   new Date(),
        approvedById: req.user!.sub,
      },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'SPACE_CREATE', entity: 'ParkingLocation', entityId: loc.id },
    });
    res.status(201).json(loc);
  } catch (e) {
    next(e);
  }
});

// --- Admin location images ---
r.post('/locations/:id/images', imageUpload.array('files', 10), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw BadRequest('No files uploaded');
    const existing = await prisma.locationImage.count({ where: { locationId: req.params.id } });
    const created = await Promise.all(
      files.map(async (f, i) => {
        const img = await storeImageBuffer(f.buffer);
        return prisma.locationImage.create({
          data: { locationId: req.params.id, url: img.url, width: img.width, height: img.height, sortOrder: existing + i },
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
    const image = await prisma.locationImage.findFirstOrThrow({
      where: { id: req.params.imageId, locationId: req.params.id },
    });
    await prisma.locationImage.delete({ where: { id: image.id } });
    await deleteImageByUrl(image.url);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// --- Admin amenities for a location ---
r.put('/locations/:id/amenities', async (req, res, next) => {
  try {
    const amenityIds: string[] = req.body?.amenityIds ?? [];
    await prisma.parkingLocationAmenity.deleteMany({ where: { locationId: req.params.id } });
    if (amenityIds.length > 0) {
      await prisma.parkingLocationAmenity.createMany({
        data: amenityIds.map((amenityId) => ({ locationId: req.params.id, amenityId })),
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// --- Admin slot management ---
const adminSlotSchema = z.object({
  code:         z.string().min(1),
  vehicleType:  z.enum(['TWO_WHEELER', 'FOUR_WHEELER', 'HEAVY']),
  hourlyPrice:  z.coerce.number().min(0),
  monthlyPrice: z.coerce.number().min(0).optional(),
});

r.post('/locations/:id/slots', validate(adminSlotSchema), async (req, res, next) => {
  try {
    const slot = await prisma.slot.create({
      data: { locationId: req.params.id, ...req.body, dailyPrice: 0 },
    });
    res.status(201).json(slot);
  } catch (e) {
    next(e);
  }
});

r.delete('/slots/:id', async (req, res, next) => {
  try {
    await prisma.slot.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// --- Locations & slots (any vendor's) ---
r.patch('/locations/:id/status', async (req, res, next) => {
  try {
    const loc = await prisma.parkingLocation.update({
      where: { id: req.params.id },
      data: { isActive: Boolean(req.body?.isActive) },
    });
    res.json(loc);
  } catch (e) {
    next(e);
  }
});

r.patch('/slots/:id/status', async (req, res, next) => {
  try {
    const slot = await prisma.slot.update({
      where: { id: req.params.id },
      data: { status: req.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
    });
    res.json(slot);
  } catch (e) {
    next(e);
  }
});

// Edit slot details (code, hourly price, monthly price, and/or vehicle type)
const updateSlotSchema = z.object({
  code:         z.string().min(1).optional(),
  hourlyPrice:  z.coerce.number().positive().optional(),
  monthlyPrice: z.coerce.number().min(0).nullable().optional(), // null clears subscription
  vehicleType:  z.enum(['TWO_WHEELER', 'FOUR_WHEELER', 'HEAVY']).optional(),
});

r.patch('/slots/:id', validate(updateSlotSchema), async (req, res, next) => {
  try {
    const slot = await prisma.slot.update({
      where: { id: req.params.id },
      data:  req.body,
    });
    res.json(slot);
  } catch (e) {
    next(e);
  }
});

// All bookings for a single slot — past, present & future (slot-wise history)
r.get('/slots/:id/bookings', async (req, res, next) => {
  try {
    const slot = await prisma.slot.findUnique({
      where: { id: req.params.id },
      include: {
        location: {
          select: {
            id: true, name: true, city: true, state: true,
            vendor: { select: { id: true, businessName: true } },
          },
        },
      },
    });
    if (!slot) return next(NotFound('Slot not found'));

    const bookings = await prisma.booking.findMany({
      where: { slotId: slot.id },
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

// --- Bookings & payments overview ---
r.get('/bookings', async (_req, res) => {
  const items = await prisma.booking.findMany({
    include: {
      user: { select: { fullName: true, email: true, phone: true } },
      slot: {
        include: {
          location: {
            include: {
              vendor: {
                select: {
                  businessName: true,
                  contactPhone: true,
                  user: { select: { fullName: true, email: true } },
                },
              },
            },
          },
        },
      },
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ items });
});

r.get('/payments', async (_req, res, next) => {
  try {
    // Return ALL bookings (online & direct) with payment + refund info.
    const items = await prisma.booking.findMany({
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        slot: {
          include: {
            location: {
              include: {
                vendor: { select: { id: true, businessName: true } },
              },
            },
          },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// Update payment method for a direct booking
r.patch('/bookings/:id/payment-method', async (req, res, next) => {
  try {
    const METHODS = ['CASH', 'UPI', 'CARD_DEBIT', 'CARD_CREDIT', 'NETBANKING', 'WALLET'];
    const method = (req.body?.paymentMethod ?? '').toUpperCase();
    if (!METHODS.includes(method)) return next(BadRequest('Invalid payment method'));
    // Use `as any` because Prisma client may not yet be regenerated for the new paymentMethod field
    const booking = await (prisma.booking.update as any)({
      where: { id: req.params.id },
      data: { paymentMethod: method },
    });
    res.json(booking);
  } catch (e) {
    next(e);
  }
});

// Record a refund against a booking (direct or online)
const refundSchema = z.object({
  amount: z.coerce.number().positive(),
  note:   z.string().optional(),
});

r.post('/bookings/:id/refund', validate(refundSchema), async (req, res, next) => {
  try {
    const { amount, note } = req.body as z.infer<typeof refundSchema>;
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (amount > Number(booking.totalAmount)) {
      return next(BadRequest('Refund amount cannot exceed total booking amount'));
    }

    if (booking.isDirectBooking) {
      // Use `as any` because Prisma client may not yet be regenerated for the new refund fields
      const updated = await (prisma.booking.update as any)({
        where: { id: req.params.id },
        data: { refundAmount: amount, refundedAt: new Date(), refundNote: note ?? null },
      });
      await prisma.auditLog.create({
        data: {
          actorId: req.user!.sub, action: 'BOOKING_REFUND',
          entity: 'Booking', entityId: booking.id,
          metadata: JSON.stringify({ amount, note }),
        },
      });
      return res.json(updated);
    }

    // Online booking — store refund on the Payment record
    const payment = booking.payments[0];
    if (!payment) return next(BadRequest('No payment record found for this booking'));

    const updatedPayment = await (prisma.payment.update as any)({
      where: { id: payment.id },
      data: {
        refundAmount: amount,
        refundedAt:   new Date(),
        refundNote:   note ?? null,
        status:       'REFUNDED',
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub, action: 'PAYMENT_REFUND',
        entity: 'Payment', entityId: payment.id,
        metadata: JSON.stringify({ amount, note }),
      },
    });
    res.json(updatedPayment);
  } catch (e) {
    next(e);
  }
});

// --- Cancel a booking (admin) ---
// --- Admin: edit a direct booking's guest details, dates, and/or booking type ---
const adminEditGuestSchema = z.object({
  guestName:          z.string().min(2).max(100).optional(),
  guestPhone:         z.string().min(7).max(20).optional(),
  guestVehicleNumber: z.string().max(20).optional(),
  guestVehicleModel:  z.string().max(80).optional(),
  bookingType:        z.enum(['HOURLY', 'MONTHLY']).optional(),
  startAt:            z.coerce.date().optional(),
  endAt:              z.coerce.date().optional(), // ignored for MONTHLY
});

r.patch('/bookings/:id/guest', validate(adminEditGuestSchema), async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { slot: true },
    });
    if (!booking) return next(NotFound('Booking not found'));
    if (!booking.isDirectBooking) return next(BadRequest('Only direct bookings can be edited'));

    const { startAt, endAt, bookingType, ...guestFields } = req.body;

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
          // Keep commission in sync with the new amount (using the booking's snapshot rate)
          commissionAmount: Math.round(recalc.amount * Number(booking.commissionRate)) / 100,
        } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub,
        action:  'BOOKING_EDIT_GUEST',
        entity:  'Booking',
        entityId: updated.id,
      },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

r.patch('/bookings/:id/cancel', async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return next(BadRequest('Booking not found'));
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
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.sub, action: 'BOOKING_CANCEL',
        entity: 'Booking', entityId: updated.id,
        metadata: req.body?.reason ? JSON.stringify({ reason: req.body.reason }) : null,
      },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// --- Customer list ---
// Returns two lists:
//   registered  – users with role CUSTOMER (have accounts)
//   guests      – unique walk-in guests from direct bookings (no account)
r.get('/customers', async (req, res, next) => {
  try {
    const search = ((req.query.search as string) ?? '').trim();

    // 1. Registered customers
    const registered = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(search
          ? {
              OR: [
                { fullName: { contains: search } },
                { email:    { contains: search } },
                { phone:    { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id:        true,
        fullName:  true,
        email:     true,
        phone:     true,
        status:    true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // 2. Walk-in / direct booking guests (vendor-created, no account)
    const directBookings = await prisma.booking.findMany({
      where: {
        isDirectBooking: true,
        guestPhone: { not: null },
        ...(search
          ? {
              OR: [
                { guestName:          { contains: search } },
                { guestPhone:         { contains: search } },
                { guestVehicleNumber: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id:                 true,
        guestName:          true,
        guestPhone:         true,
        guestVehicleNumber: true,
        guestVehicleModel:  true,
        totalAmount:        true,
        status:             true,
        createdAt:          true,
        slot: {
          select: {
            location: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Deduplicate guests by phone — keep most-recent name/vehicle, accumulate booking count
    const guestMap = new Map<string, {
      phone: string; name: string; vehicleNumber: string | null;
      vehicleModel: string | null; bookingCount: number; lastSeen: Date;
      locations: Set<string>;
    }>();

    for (const b of directBookings) {
      const phone = b.guestPhone!;
      const existing = guestMap.get(phone);
      if (!existing) {
        guestMap.set(phone, {
          phone,
          name:          b.guestName ?? '',
          vehicleNumber: b.guestVehicleNumber ?? null,
          vehicleModel:  b.guestVehicleModel  ?? null,
          bookingCount:  1,
          lastSeen:      b.createdAt,
          locations:     new Set(b.slot?.location?.name ? [b.slot.location.name] : []),
        });
      } else {
        existing.bookingCount++;
        if (b.createdAt > existing.lastSeen) {
          existing.lastSeen      = b.createdAt;
          existing.name          = b.guestName ?? existing.name;
          existing.vehicleNumber = b.guestVehicleNumber ?? existing.vehicleNumber;
          existing.vehicleModel  = b.guestVehicleModel  ?? existing.vehicleModel;
        }
        if (b.slot?.location?.name) existing.locations.add(b.slot.location.name);
      }
    }

    const guests = Array.from(guestMap.values()).map((g) => ({
      ...g,
      locations: Array.from(g.locations),
    }));

    res.json({ registered, guests });
  } catch (e) {
    next(e);
  }
});

// --- Customer details (with full booking history) ---

// Shared shape: include slot + location + vendor + payment summary
const customerBookingInclude = {
  slot: {
    include: {
      location: {
        select: {
          id: true, name: true, city: true, state: true,
          vendor: { select: { businessName: true } },
        },
      },
    },
  },
  payments: {
    select: {
      id: true, status: true, amount: true, provider: true, createdAt: true,
    },
  },
} as const;

// Registered customer (by User.id)
r.get('/customers/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, fullName: true, email: true, phone: true,
        status: true, emailVerified: true, createdAt: true, updatedAt: true,
        role: true, provider: true,
      },
    });
    if (!user) return next(NotFound(`No customer found with id ${req.params.id}`));
    if (user.role !== 'CUSTOMER') return next(BadRequest('User is not a customer'));

    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      include: customerBookingInclude,
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate stats
    const confirmed = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED');
    const totalSpent = confirmed.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    res.json({
      customer: user,
      bookings,
      stats: {
        bookingsTotal:     bookings.length,
        bookingsConfirmed: confirmed.length,
        bookingsCancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
        totalSpent,
      },
    });
  } catch (e) {
    next(e);
  }
});

// Walk-in guest (by phone — guests don't have accounts)
r.get('/customers/guest/:phone', async (req, res, next) => {
  try {
    const phone = String(req.params.phone);
    const bookings = await prisma.booking.findMany({
      where: { isDirectBooking: true, guestPhone: phone },
      include: customerBookingInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (bookings.length === 0) {
      return next(NotFound('No bookings found for that guest phone'));
    }

    // Most recent booking has the latest snapshot of name/vehicle info
    const latest = bookings[0];
    const confirmed = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED');
    const totalSpent = confirmed.reduce((sum, b) => sum + Number(b.totalAmount), 0);

    // Unique vehicles seen across all bookings
    const vehicles = new Map<string, { number: string; model: string | null }>();
    bookings.forEach((b) => {
      if (b.guestVehicleNumber) {
        vehicles.set(b.guestVehicleNumber, {
          number: b.guestVehicleNumber,
          model:  b.guestVehicleModel ?? null,
        });
      }
    });

    // Unique locations visited
    const locations = new Set<string>();
    bookings.forEach((b) => { if (b.slot?.location?.name) locations.add(b.slot.location.name); });

    res.json({
      customer: {
        name:           latest.guestName,
        phone:          latest.guestPhone,
        vehicleNumber:  latest.guestVehicleNumber,
        vehicleModel:   latest.guestVehicleModel,
        firstSeen:      bookings[bookings.length - 1].createdAt,
        lastSeen:       latest.createdAt,
      },
      bookings,
      stats: {
        bookingsTotal:     bookings.length,
        bookingsConfirmed: confirmed.length,
        bookingsCancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
        totalSpent,
        vehicles:          [...vehicles.values()],
        locations:         [...locations],
      },
    });
  } catch (e) {
    next(e);
  }
});

// Edit a registered customer's profile (admin can change name / email / phone)
const updateRegisteredCustomerSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  email:    z.string().email().optional(),
  phone:    z.string().min(7).max(20).nullable().optional(),
});

r.patch('/customers/:id', validate(updateRegisteredCustomerSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    if (user.role !== 'CUSTOMER') return next(BadRequest('User is not a customer'));

    // Email & phone are @unique — guard against collisions for a friendlier message
    if (req.body.email && req.body.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
      if (existing && existing.id !== user.id) {
        return next(BadRequest('Another account already uses that email'));
      }
    }
    if (req.body.phone && req.body.phone !== user.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: req.body.phone } });
      if (existing && existing.id !== user.id) {
        return next(BadRequest('Another account already uses that phone'));
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data:  req.body,
      select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'CUSTOMER_EDIT', entity: 'User', entityId: updated.id },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Edit a walk-in guest's details across all their direct bookings (matched by current phone).
// Guests don't have an account — they're aggregated from Booking rows by guestPhone, so we
// update every direct booking that currently belongs to that guest in one shot.
const updateGuestCustomerSchema = z.object({
  /** Current phone — used to identify the guest's booking set */
  currentPhone:       z.string().min(7).max(20),
  guestName:          z.string().min(1).max(100).optional(),
  guestPhone:         z.string().min(7).max(20).optional(),
  guestVehicleNumber: z.string().max(20).nullable().optional(),
  guestVehicleModel:  z.string().max(80).nullable().optional(),
});

r.patch('/customers/guest', validate(updateGuestCustomerSchema), async (req, res, next) => {
  try {
    const { currentPhone, ...patch } = req.body as z.infer<typeof updateGuestCustomerSchema>;

    const data: Record<string, unknown> = {};
    if (patch.guestName          !== undefined) data.guestName          = patch.guestName;
    if (patch.guestPhone         !== undefined) data.guestPhone         = patch.guestPhone;
    if (patch.guestVehicleNumber !== undefined) data.guestVehicleNumber = patch.guestVehicleNumber;
    if (patch.guestVehicleModel  !== undefined) data.guestVehicleModel  = patch.guestVehicleModel;

    if (Object.keys(data).length === 0) {
      return next(BadRequest('No fields to update'));
    }

    const result = await prisma.booking.updateMany({
      where: { isDirectBooking: true, guestPhone: currentPhone },
      data,
    });

    if (result.count === 0) {
      return next(NotFound('No bookings found for that guest phone'));
    }

    await prisma.auditLog.create({
      data: {
        actorId:  req.user!.sub,
        action:   'GUEST_EDIT',
        entity:   'Booking',
        entityId: currentPhone,
        metadata: JSON.stringify({ updated: result.count, fields: Object.keys(data) }),
      },
    });

    res.json({ updated: result.count });
  } catch (e) {
    next(e);
  }
});

// Toggle customer account status
r.patch('/customers/:id/status', async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    if (user.role !== 'CUSTOMER') return next(BadRequest('User is not a customer'));
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data:  { status: newStatus },
      select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'CUSTOMER_STATUS', entity: 'User', entityId: updated.id },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// --- Amenities master list (admin-managed) ---
r.get('/amenities', async (_req, res, next) => {
  try {
    const items = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// Create amenity — JSON body { name, description?, iconName? }
// iconName is a Lucide icon name string (e.g. "Cctv", "ShieldCheck")
r.post('/amenities', async (req, res, next) => {
  try {
    const name = (req.body.name ?? '').trim();
    if (name.length < 2) return next(BadRequest('Name must be at least 2 characters'));
    const icon = (req.body.iconName ?? '').trim();
    const amenity = await prisma.amenity.create({
      data: { name, icon, description: req.body.description?.trim() || null },
    });
    res.status(201).json(amenity);
  } catch (e) {
    next(e);
  }
});

// Update amenity icon by Lucide icon name
r.patch('/amenities/:id', async (req, res, next) => {
  try {
    const iconName = (req.body.iconName ?? '').trim();
    if (!iconName) return next(BadRequest('iconName is required'));
    const existing = await prisma.amenity.findUniqueOrThrow({ where: { id: req.params.id } });
    // Clean up old uploaded image if replacing with a named icon
    if (existing.icon?.startsWith('http')) await deleteImageByUrl(existing.icon);
    const updated = await prisma.amenity.update({
      where: { id: req.params.id },
      data: { icon: iconName },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

r.delete('/amenities/:id', async (req, res, next) => {
  try {
    const existing = await prisma.amenity.findUniqueOrThrow({ where: { id: req.params.id } });
    if (existing.icon?.startsWith('http')) await deleteImageByUrl(existing.icon);
    await prisma.amenity.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// --- Admin / Sub-Admin management ---
const createAdminSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'SUB_ADMIN']),
});

// List all admins & sub-admins
r.get('/admins', async (_req, res, next) => {
  try {
    const items = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] } },
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// Create admin / sub-admin (super admin only)
r.post('/admins', requireRole('SUPER_ADMIN'), validate(createAdminSchema), async (req, res, next) => {
  try {
    const { email, fullName, password, role } = req.body as z.infer<typeof createAdminSchema>;
    const user = await prisma.user.create({
      data: { email, fullName, role, passwordHash: await hashPassword(password) },
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

// Toggle admin active/inactive (super admin only)
r.patch('/admins/:id/status', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: req.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
    });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

// Delete admin / sub-admin (super admin only, cannot delete self or another super admin)
r.delete('/admins/:id', requireRole('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const target = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    if (target.role === 'SUPER_ADMIN') return next(BadRequest('Cannot delete a Super Admin'));
    if (target.id === req.user!.sub) return next(BadRequest('Cannot delete yourself'));
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Commission settings ───────────────────────────────────────────────────────
r.get('/settings/commission', async (_req, res, next) => {
  try {
    const rate = await getCommissionRate();
    res.json({ rate });
  } catch (e) {
    next(e);
  }
});

const commissionRateSchema = z.object({ rate: z.coerce.number().min(0).max(100) });

r.patch('/settings/commission', validate(commissionRateSchema), async (req, res, next) => {
  try {
    const rate = await setCommissionRate(Number(req.body.rate));
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'COMMISSION_RATE_UPDATE', entity: 'Setting', entityId: 'commission_rate', metadata: JSON.stringify({ rate }) },
    });
    res.json({ rate });
  } catch (e) {
    next(e);
  }
});

// Mark a booking's commission as PAID or PENDING (vendor settled with the company)
const commissionStatusSchema = z.object({ status: z.enum(['PAID', 'PENDING']) });

r.patch('/bookings/:id/commission', validate(commissionStatusSchema), async (req, res, next) => {
  try {
    const status = req.body.status as 'PAID' | 'PENDING';
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        commissionStatus: status,
        commissionPaidAt: status === 'PAID' ? new Date() : null,
      },
    });
    await prisma.auditLog.create({
      data: { actorId: req.user!.sub, action: 'COMMISSION_MARK', entity: 'Booking', entityId: updated.id, metadata: JSON.stringify({ status }) },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// Commission overview for the admin dashboard / bookings page
r.get('/commission/summary', async (req, res, next) => {
  try {
    // Optional date filter (?period=day|month|year|fy|custom[&from&to]). When NO
    // filter param is passed, return all-time (keeps the Bookings page summary intact).
    const hasFilter = Boolean(req.query.period || req.query.from || req.query.to);
    const range = hasFilter
      ? resolveDateRange(req.query.period as string, req.query.from as string, req.query.to as string)
      : null;

    // Only CONFIRMED / COMPLETED bookings represent real revenue & owed commission.
    const due = await prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        ...(range ? { createdAt: range } : {}),
      },
      select: {
        commissionAmount: true,
        commissionStatus: true,
        totalAmount: true,
        slot: { select: { location: { select: { vendor: { select: { id: true, businessName: true } } } } } },
      },
    });
    const totalCommission = due.reduce((s, b) => s + Number(b.commissionAmount), 0);
    const paidCommission  = due.filter((b) => b.commissionStatus === 'PAID')
      .reduce((s, b) => s + Number(b.commissionAmount), 0);
    const grossRevenue    = due.reduce((s, b) => s + Number(b.totalAmount), 0);

    // Per-vendor breakdown — who owes what.
    const byVendor = new Map<string, { vendorId: string; businessName: string; total: number; paid: number; bookings: number }>();
    for (const b of due) {
      const v = b.slot?.location?.vendor;
      if (!v) continue;
      const row = byVendor.get(v.id) ?? { vendorId: v.id, businessName: v.businessName, total: 0, paid: 0, bookings: 0 };
      row.total    += Number(b.commissionAmount);
      row.bookings += 1;
      if (b.commissionStatus === 'PAID') row.paid += Number(b.commissionAmount);
      byVendor.set(v.id, row);
    }

    res.json({
      rate: await getCommissionRate(),
      grossRevenue,
      totalCommission,
      paidCommission,
      pendingCommission: totalCommission - paidCommission,
      bookings: due.length,
      byVendor: [...byVendor.values()]
        .map((r) => ({ ...r, pending: r.total - r.paid }))
        .sort((a, b) => b.total - a.total),
    });
  } catch (e) {
    next(e);
  }
});

export default r;
