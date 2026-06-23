/**
 * Admin service — business logic for the admin portal: dashboard stats, vendor
 * approval/management, parking-space approval, slots, bookings, payments,
 * customers, amenities, admin-user management and commission settings.
 * All persistence goes through Prisma; no HTTP concerns live here.
 */
import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/http.js';
import { hashPassword } from '../../lib/password.js';
import { calculateBookingAmount } from '../../lib/pricing.js';
import { getCommissionRate, setCommissionRate } from '../../lib/commission.js';
import { resolveDateRange } from '../../lib/dateRange.js';
import { storeImageBuffer, deleteImageByUrl, deleteDocumentByUrl } from '../../lib/images.js';
import type {
  UpdateVendorInput,
  VendorLeadStatusInput,
  CreateVendorInput,
  UpdateSpaceInput,
  CreateLocationInput,
  AdminSlotInput,
  UpdateSlotInput,
  RefundInput,
  AdminEditGuestInput,
  UpdateRegisteredCustomerInput,
  UpdateGuestCustomerInput,
  CreateAdminInput,
  CommissionStatusInput,
} from './admin.schema.js';

const ADMIN_USER_SELECT = { fullName: true, email: true, phone: true, status: true } as const;

// ── Dashboard stats ─────────────────────────────────────────────────────────
export const getStats = async (startQ?: string, endQ?: string) => {
  // Range window — defaults to today if no params supplied
  const now = new Date();
  const defaultStart = new Date(now); defaultStart.setHours(0,  0,  0,   0);
  const defaultEnd   = new Date(now); defaultEnd.setHours(23, 59, 59, 999);

  const rangeStart: Date = startQ ? new Date(startQ) : defaultStart;
  const rangeEnd:   Date = endQ   ? new Date(endQ)   : defaultEnd;

  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    throw BadRequest('Invalid start or end date');
  }

  const rangeCond = { gte: rangeStart, lte: rangeEnd };

  const [
    totalVendors, pendingVendors, approvedVendors,
    pendingProfileEdits,
    totalSpaces, pendingSpaces, approvedSpaces,
    rangeBookingsTotal,
    rangeBookingsConfirmed,
    rangeBookingsCancelled,
    rangeRevenueResult,
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
    prisma.booking.count({ where: { createdAt: rangeCond } }),
    prisma.booking.count({ where: { status: 'CONFIRMED', createdAt: rangeCond } }),
    prisma.booking.count({ where: { status: 'CANCELLED', createdAt: rangeCond } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'PAID', createdAt: rangeCond },
    }),
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

  return {
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
  };
};

// ── Vendors ─────────────────────────────────────────────────────────────────
export const listVendors = async (status?: string) => {
  const items = await prisma.vendor.findMany({
    where: status ? { status: status as any } : {},
    include: {
      user: { select: { fullName: true, email: true, phone: true, status: true } },
      // Lightweight location data — used by admin UI for state/city filters.
      locations: { select: { state: true, city: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return { items };
};

export const getVendor = async (id: string) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({
    where: { id },
    include: {
      user: {
        select: {
          id: true, fullName: true, email: true, phone: true,
          status: true, createdAt: true, emailVerified: true,
        },
      },
      locations: {
        include: {
          // All images — the Vendor Details page shows both a cover thumbnail
          // (images[0]) AND a full "Photos" gallery of every uploaded image.
          images: { orderBy: { sortOrder: 'asc' } },
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

  return {
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
    bookings: recentBookings,
  };
};

export const getVendorCommission = async (id: string, period?: string, from?: string, to?: string) => {
  const range = resolveDateRange(period, from, to);
  const rows = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      slot:   { location: { vendor: { id } } },
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

  return {
    total,
    paid,
    pending: total - paid,
    bookings: rows.length,
    bySpace: [...bySpace.values()].map((s) => ({ ...s, pending: s.total - s.paid })),
  };
};

export const approveVendor = async (id: string, actorId: string) => {
  const vendor = await prisma.vendor.update({
    where: { id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedById: actorId },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'VENDOR_APPROVE', entity: 'Vendor', entityId: vendor.id },
  });
  return vendor;
};

export const rejectVendor = async (id: string, actorId: string, note?: string) => {
  const vendor = await prisma.vendor.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionNote: note ?? null,
      rejectedAt: new Date(),
      rejectedById: actorId,
    },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'VENDOR_REJECT', entity: 'Vendor', entityId: vendor.id },
  });
  return vendor;
};

export const setVendorStatus = async (id: string, actorId: string, statusRaw: unknown) => {
  // Narrow to the literal union — without `as const`, TS widens to `string`
  // and Prisma rejects it as not assignable to `VendorStatus`.
  const status = (statusRaw === 'INACTIVE' ? 'INACTIVE' : 'APPROVED') as 'INACTIVE' | 'APPROVED';
  const data =
    status === 'INACTIVE'
      ? { status, deactivatedAt: new Date(), deactivatedById: actorId }
      : { status, deactivatedAt: null, deactivatedById: null };
  const vendor = await prisma.vendor.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: status === 'INACTIVE' ? 'VENDOR_DEACTIVATE' : 'VENDOR_REACTIVATE',
      entity: 'Vendor',
      entityId: vendor.id,
    },
  });
  return vendor;
};

export const updateVendor = async (id: string, actorId: string, body: UpdateVendorInput) => {
  const { fullName, phone, email, ...vendorData } = body;

  const current = await prisma.vendor.findUniqueOrThrow({
    where: { id },
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
    ? { aadharVerifiedAt: new Date(), aadharVerifiedById: actorId }
    : {};
  const vendor = await prisma.vendor.update({
    where: { id },
    data:  { ...vendorData, ...verifyStamp },
    include: { user: { select: ADMIN_USER_SELECT } },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'VENDOR_EDIT', entity: 'Vendor', entityId: vendor.id },
  });
  return vendor;
};

export const approveAadhaar = async (id: string, actorId: string) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id } });
  if (!vendor.aadharDocUrl) throw BadRequest('No Aadhaar document to verify');
  const updated = await prisma.vendor.update({
    where: { id },
    data: { aadharVerifiedAt: new Date(), aadharVerifiedById: actorId },
    include: { user: { select: ADMIN_USER_SELECT } },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'VENDOR_AADHAAR_APPROVE', entity: 'Vendor', entityId: updated.id },
  });
  return updated;
};

export const rejectAadhaar = async (id: string, actorId: string) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id } });
  if (vendor.aadharDocUrl) await deleteDocumentByUrl(vendor.aadharDocUrl).catch(() => {});
  const updated = await prisma.vendor.update({
    where: { id },
    data: { aadharDocUrl: null, aadharVerifiedAt: null, aadharVerifiedById: null },
    include: { user: { select: ADMIN_USER_SELECT } },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'VENDOR_AADHAAR_REJECT', entity: 'Vendor', entityId: updated.id },
  });
  return updated;
};

// ── Vendor leads ────────────────────────────────────────────────────────────
export const listVendorLeads = async (status?: string, type?: string) => {
  const items = await prisma.vendorLead.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(type ? { leadType: type } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return { items };
};

export const updateVendorLead = async (id: string, actorId: string, status: VendorLeadStatusInput['status']) => {
  const lead = await prisma.vendorLead.update({
    where: { id },
    data: {
      status,
      reviewedAt:   status === 'PENDING' ? null : new Date(),
      reviewedById: status === 'PENDING' ? null : actorId,
    },
  });
  await prisma.auditLog.create({
    data: { actorId, action: `VENDOR_LEAD_${status}`, entity: 'VendorLead', entityId: lead.id },
  });
  return lead;
};

export const createVendor = async (actorId: string, body: CreateVendorInput) => {
  const { email, fullName, phone, businessName, contactPhone, address, aadharNumber, aadharDocUrl, tempPassword } = body;
  return prisma.user.create({
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
          aadharVerifiedById: aadharDocUrl ? actorId : null,
          status: 'APPROVED', approvedAt: new Date(),
          createdVia: 'ADMIN', createdById: actorId,
        },
      },
    },
    include: { vendor: true },
  });
};

// ── Vendor profile-edit approval ──────────────────────────────────────────────
const VENDOR_USER_FIELDS = new Set(['fullName', 'phone', 'email']);

export const approveVendorProfile = async (id: string, actorId: string) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({
    where: { id },
    include: { user: { select: { id: true } } },
  });
  if (!vendor.pendingProfileData) throw BadRequest('No pending profile edits to approve');
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
    ? { aadharVerifiedAt: new Date(), aadharVerifiedById: actorId }
    : {};

  const updated = await prisma.vendor.update({
    where: { id },
    data: { ...vendorUpdate, ...verifyStamp, pendingProfileData: null },
    include: { user: { select: ADMIN_USER_SELECT } },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'VENDOR_PROFILE_APPROVE', entity: 'Vendor', entityId: vendor.id },
  });
  return updated;
};

export const rejectVendorProfile = async (id: string, actorId: string, note?: string) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id } });
  if (vendor.pendingProfileData) {
    const pending = JSON.parse(vendor.pendingProfileData) as Record<string, unknown>;
    // Delete the newly uploaded aadhar doc (if any) since it won't be used
    if (pending.aadharDocUrl && pending.aadharDocUrl !== vendor.aadharDocUrl) {
      await deleteDocumentByUrl(pending.aadharDocUrl as string);
    }
  }
  const updated = await prisma.vendor.update({
    where: { id },
    data: { pendingProfileData: null, rejectionNote: note ?? null },
    include: { user: { select: ADMIN_USER_SELECT } },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'VENDOR_PROFILE_REJECT', entity: 'Vendor', entityId: vendor.id },
  });
  return updated;
};

// ── Parking spaces ────────────────────────────────────────────────────────────
export const getSpace = async (id: string) => {
  return prisma.parkingLocation.findUniqueOrThrow({
    where: { id },
    include: {
      vendor: { include: { user: { select: { fullName: true, email: true } } } },
      images: { orderBy: { sortOrder: 'asc' } },
      slots:  { orderBy: { createdAt: 'asc' } },
      amenities: { include: { amenity: true } },
    },
  });
};

export const getSpaceDetails = async (id: string) => {
  const space = await prisma.parkingLocation.findUniqueOrThrow({
    where: { id },
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

  return {
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
  };
};

export const listSpaces = async (status?: string, vendorId?: string) => {
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
  return { items };
};

export const approveSpace = async (id: string, actorId: string) => {
  const space = await prisma.parkingLocation.findUniqueOrThrow({ where: { id } });
  const pendingEdits = space.pendingData ? (JSON.parse(space.pendingData) as Record<string, unknown>) : null;
  const updated = await prisma.parkingLocation.update({
    where: { id },
    data: {
      ...(pendingEdits ?? {}),
      approvalStatus: 'APPROVED',
      approvalNote: null,
      pendingData: null,
      isActive: true,
      approvedAt: new Date(),
      approvedById: actorId,
    },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'SPACE_APPROVE', entity: 'ParkingLocation', entityId: updated.id },
  });
  return updated;
};

export const rejectSpace = async (id: string, actorId: string, note?: string) => {
  const updated = await prisma.parkingLocation.update({
    where: { id },
    data: {
      approvalStatus: 'REJECTED',
      approvalNote: note ?? null,
      pendingData: null,
      isActive: false,
    },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'SPACE_REJECT', entity: 'ParkingLocation', entityId: updated.id },
  });
  return updated;
};

export const rejectSpaceEdits = async (id: string, actorId: string, note?: string) => {
  const updated = await prisma.parkingLocation.update({
    where: { id },
    data: { pendingData: null, approvalNote: note ?? null },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'SPACE_REJECT_EDITS', entity: 'ParkingLocation', entityId: updated.id },
  });
  return updated;
};

export const updateSpace = async (id: string, actorId: string, body: UpdateSpaceInput) => {
  const updated = await prisma.parkingLocation.update({
    where: { id },
    data: body,
    include: {
      vendor: { include: { user: { select: { fullName: true, email: true } } } },
      slots: true,
    },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'SPACE_EDIT', entity: 'ParkingLocation', entityId: updated.id },
  });
  return updated;
};

export const createLocation = async (actorId: string, body: CreateLocationInput) => {
  const { vendorId, ...locationData } = body;
  const loc = await prisma.parkingLocation.create({
    data: {
      ...locationData,
      vendorId,
      approvalStatus: 'APPROVED',
      isActive: true,
      approvedAt:   new Date(),
      approvedById: actorId,
    },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'SPACE_CREATE', entity: 'ParkingLocation', entityId: loc.id },
  });
  return loc;
};

// ── Location images / amenities / slots ───────────────────────────────────────
export const addLocationImages = async (locationId: string, files: Express.Multer.File[]) => {
  if (!files.length) throw BadRequest('No files uploaded');
  const existing = await prisma.locationImage.count({ where: { locationId } });
  const created = await Promise.all(
    files.map(async (f, i) => {
      const img = await storeImageBuffer(f.buffer);
      return prisma.locationImage.create({
        data: { locationId, url: img.url, width: img.width, height: img.height, sortOrder: existing + i },
      });
    }),
  );
  return { items: created };
};

export const deleteLocationImage = async (locationId: string, imageId: string) => {
  const image = await prisma.locationImage.findFirstOrThrow({
    where: { id: imageId, locationId },
  });
  await prisma.locationImage.delete({ where: { id: image.id } });
  await deleteImageByUrl(image.url);
};

export const setLocationAmenities = async (locationId: string, amenityIds: string[]) => {
  await prisma.parkingLocationAmenity.deleteMany({ where: { locationId } });
  if (amenityIds.length > 0) {
    await prisma.parkingLocationAmenity.createMany({
      data: amenityIds.map((amenityId) => ({ locationId, amenityId })),
    });
  }
  return { ok: true };
};

export const createSlot = async (locationId: string, body: AdminSlotInput) => {
  return prisma.slot.create({
    data: { locationId, ...body, dailyPrice: 0 },
  });
};

export const deleteSlot = async (id: string) => {
  await prisma.slot.delete({ where: { id } });
  return { ok: true };
};

export const setLocationStatus = async (id: string, isActive: boolean) => {
  return prisma.parkingLocation.update({
    where: { id },
    data: { isActive },
  });
};

export const setSlotStatus = async (id: string, statusRaw: unknown) => {
  return prisma.slot.update({
    where: { id },
    data: { status: statusRaw === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
  });
};

export const updateSlot = async (id: string, body: UpdateSlotInput) => {
  return prisma.slot.update({ where: { id }, data: body });
};

export const getSlotBookings = async (id: string) => {
  const slot = await prisma.slot.findUnique({
    where: { id },
    include: {
      location: {
        select: {
          id: true, name: true, city: true, state: true,
          vendor: { select: { id: true, businessName: true } },
        },
      },
    },
  });
  if (!slot) throw NotFound('Slot not found');

  const bookings = await prisma.booking.findMany({
    where: { slotId: slot.id },
    include: {
      user:     { select: { fullName: true, email: true, phone: true } },
      payments: { select: { id: true, status: true, amount: true, provider: true, createdAt: true } },
    },
    orderBy: { startAt: 'desc' },
  });

  const revenueBookings = bookings.filter((b) => ['CONFIRMED', 'COMPLETED'].includes(b.status));
  return {
    slot,
    bookings,
    stats: {
      total:     bookings.length,
      confirmed: revenueBookings.length,
      cancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
      revenue:   revenueBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0),
    },
  };
};

// ── Bookings & payments ───────────────────────────────────────────────────────
export const listBookings = async () => {
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
  return { items };
};

export const listPayments = async () => {
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
  return { items };
};

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD_DEBIT', 'CARD_CREDIT', 'NETBANKING', 'WALLET'];

export const setBookingPaymentMethod = async (id: string, paymentMethodRaw: string) => {
  const method = (paymentMethodRaw ?? '').toUpperCase();
  if (!PAYMENT_METHODS.includes(method)) throw BadRequest('Invalid payment method');
  // Use `as any` because Prisma client may not yet be regenerated for the new paymentMethod field
  return (prisma.booking.update as any)({
    where: { id },
    data: { paymentMethod: method },
  });
};

export const refundBooking = async (id: string, actorId: string, body: RefundInput) => {
  const { amount, note } = body;
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id },
    include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (amount > Number(booking.totalAmount)) {
    throw BadRequest('Refund amount cannot exceed total booking amount');
  }

  if (booking.isDirectBooking) {
    // Use `as any` because Prisma client may not yet be regenerated for the new refund fields
    const updated = await (prisma.booking.update as any)({
      where: { id },
      data: { refundAmount: amount, refundedAt: new Date(), refundNote: note ?? null },
    });
    await prisma.auditLog.create({
      data: {
        actorId, action: 'BOOKING_REFUND',
        entity: 'Booking', entityId: booking.id,
        metadata: JSON.stringify({ amount, note }),
      },
    });
    return updated;
  }

  // Online booking — store refund on the Payment record
  const payment = booking.payments[0];
  if (!payment) throw BadRequest('No payment record found for this booking');

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
      actorId, action: 'PAYMENT_REFUND',
      entity: 'Payment', entityId: payment.id,
      metadata: JSON.stringify({ amount, note }),
    },
  });
  return updatedPayment;
};

export const editBookingGuest = async (id: string, actorId: string, body: AdminEditGuestInput) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { slot: true },
  });
  if (!booking) throw NotFound('Booking not found');
  if (!booking.isDirectBooking) throw BadRequest('Only direct bookings can be edited');

  const { startAt, endAt, bookingType, ...guestFields } = body;

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
      throw BadRequest(e?.message ?? 'Could not recalculate booking amount');
    }
  }

  const updated = await prisma.booking.update({
    where: { id },
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
    data: { actorId, action: 'BOOKING_EDIT_GUEST', entity: 'Booking', entityId: updated.id },
  });

  return updated;
};

export const cancelBooking = async (id: string, actorId: string, reason?: string) => {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw BadRequest('Booking not found');
  if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.status)) {
    throw BadRequest('Only confirmed or pending bookings can be cancelled');
  }
  const updated = await prisma.booking.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelReason: reason ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId, action: 'BOOKING_CANCEL',
      entity: 'Booking', entityId: updated.id,
      metadata: reason ? JSON.stringify({ reason }) : null,
    },
  });
  return updated;
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const listCustomers = async (searchRaw?: string) => {
  const search = (searchRaw ?? '').trim();

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

  return { registered, guests };
};

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

export const getCustomer = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, email: true, phone: true,
      status: true, emailVerified: true, createdAt: true, updatedAt: true,
      role: true, provider: true,
    },
  });
  if (!user) throw NotFound(`No customer found with id ${id}`);
  if (user.role !== 'CUSTOMER') throw BadRequest('User is not a customer');

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    include: customerBookingInclude,
    orderBy: { createdAt: 'desc' },
  });

  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED');
  const totalSpent = confirmed.reduce((sum, b) => sum + Number(b.totalAmount), 0);

  return {
    customer: user,
    bookings,
    stats: {
      bookingsTotal:     bookings.length,
      bookingsConfirmed: confirmed.length,
      bookingsCancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
      totalSpent,
    },
  };
};

export const getGuestCustomer = async (phoneRaw: string) => {
  const phone = String(phoneRaw);
  const bookings = await prisma.booking.findMany({
    where: { isDirectBooking: true, guestPhone: phone },
    include: customerBookingInclude,
    orderBy: { createdAt: 'desc' },
  });

  if (bookings.length === 0) {
    throw NotFound('No bookings found for that guest phone');
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

  return {
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
  };
};

export const updateRegisteredCustomer = async (
  id: string,
  actorId: string,
  body: UpdateRegisteredCustomerInput,
) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (user.role !== 'CUSTOMER') throw BadRequest('User is not a customer');

  // Email & phone are @unique — guard against collisions for a friendlier message
  if (body.email && body.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing && existing.id !== user.id) {
      throw BadRequest('Another account already uses that email');
    }
  }
  if (body.phone && body.phone !== user.phone) {
    const existing = await prisma.user.findUnique({ where: { phone: body.phone } });
    if (existing && existing.id !== user.id) {
      throw BadRequest('Another account already uses that phone');
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data:  body,
    select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'CUSTOMER_EDIT', entity: 'User', entityId: updated.id },
  });
  return updated;
};

export const updateGuestCustomer = async (actorId: string, body: UpdateGuestCustomerInput) => {
  const { currentPhone, ...patch } = body;

  const data: Record<string, unknown> = {};
  if (patch.guestName          !== undefined) data.guestName          = patch.guestName;
  if (patch.guestPhone         !== undefined) data.guestPhone         = patch.guestPhone;
  if (patch.guestVehicleNumber !== undefined) data.guestVehicleNumber = patch.guestVehicleNumber;
  if (patch.guestVehicleModel  !== undefined) data.guestVehicleModel  = patch.guestVehicleModel;

  if (Object.keys(data).length === 0) {
    throw BadRequest('No fields to update');
  }

  const result = await prisma.booking.updateMany({
    where: { isDirectBooking: true, guestPhone: currentPhone },
    data,
  });

  if (result.count === 0) {
    throw NotFound('No bookings found for that guest phone');
  }

  await prisma.auditLog.create({
    data: {
      actorId,
      action:   'GUEST_EDIT',
      entity:   'Booking',
      entityId: currentPhone,
      metadata: JSON.stringify({ updated: result.count, fields: Object.keys(data) }),
    },
  });

  return { updated: result.count };
};

export const toggleCustomerStatus = async (id: string, actorId: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (user.role !== 'CUSTOMER') throw BadRequest('User is not a customer');
  const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const updated = await prisma.user.update({
    where: { id },
    data:  { status: newStatus },
    select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'CUSTOMER_STATUS', entity: 'User', entityId: updated.id },
  });
  return updated;
};

// ── Amenities master list ─────────────────────────────────────────────────────
export const listAmenities = async () => {
  const items = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
  return { items };
};

export const createAmenity = async (nameRaw: unknown, iconNameRaw: unknown, descriptionRaw: unknown) => {
  const name = (nameRaw as string ?? '').trim();
  if (name.length < 2) throw BadRequest('Name must be at least 2 characters');
  const icon = (iconNameRaw as string ?? '').trim();
  return prisma.amenity.create({
    data: { name, icon, description: (descriptionRaw as string)?.trim() || null },
  });
};

export const updateAmenity = async (id: string, iconNameRaw: unknown) => {
  const iconName = (iconNameRaw as string ?? '').trim();
  if (!iconName) throw BadRequest('iconName is required');
  const existing = await prisma.amenity.findUniqueOrThrow({ where: { id } });
  // Clean up old uploaded image if replacing with a named icon
  if (existing.icon?.startsWith('http')) await deleteImageByUrl(existing.icon);
  return prisma.amenity.update({
    where: { id },
    data: { icon: iconName },
  });
};

export const deleteAmenity = async (id: string) => {
  const existing = await prisma.amenity.findUniqueOrThrow({ where: { id } });
  if (existing.icon?.startsWith('http')) await deleteImageByUrl(existing.icon);
  await prisma.amenity.delete({ where: { id } });
  return { ok: true };
};

// ── Admin / Sub-Admin management ──────────────────────────────────────────────
export const listAdmins = async () => {
  const items = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] } },
    select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return { items };
};

export const createAdmin = async (body: CreateAdminInput) => {
  const { email, fullName, password, role } = body;
  return prisma.user.create({
    data: { email, fullName, role, passwordHash: await hashPassword(password) },
    select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
  });
};

export const setAdminStatus = async (id: string, statusRaw: unknown) => {
  return prisma.user.update({
    where: { id },
    data: { status: statusRaw === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
    select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
  });
};

export const deleteAdmin = async (id: string, actorId: string) => {
  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (target.role === 'SUPER_ADMIN') throw BadRequest('Cannot delete a Super Admin');
  if (target.id === actorId) throw BadRequest('Cannot delete yourself');
  await prisma.user.delete({ where: { id } });
  return { ok: true };
};

// ── Commission settings ───────────────────────────────────────────────────────
export const getCommissionSetting = async () => {
  const rate = await getCommissionRate();
  return { rate };
};

export const updateCommissionSetting = async (actorId: string, rateRaw: number) => {
  const rate = await setCommissionRate(Number(rateRaw));
  await prisma.auditLog.create({
    data: { actorId, action: 'COMMISSION_RATE_UPDATE', entity: 'Setting', entityId: 'commission_rate', metadata: JSON.stringify({ rate }) },
  });
  return { rate };
};

export const setBookingCommissionStatus = async (
  id: string,
  actorId: string,
  status: CommissionStatusInput['status'],
) => {
  const updated = await prisma.booking.update({
    where: { id },
    data: {
      commissionStatus: status,
      commissionPaidAt: status === 'PAID' ? new Date() : null,
    },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'COMMISSION_MARK', entity: 'Booking', entityId: updated.id, metadata: JSON.stringify({ status }) },
  });
  return updated;
};

export const commissionSummary = async (period?: string, from?: string, to?: string) => {
  // Optional date filter (?period=day|month|year|fy|custom[&from&to]). When NO
  // filter param is passed, return all-time (keeps the Bookings page summary intact).
  const hasFilter = Boolean(period || from || to);
  const range = hasFilter ? resolveDateRange(period as string, from as string, to as string) : null;

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

  return {
    rate: await getCommissionRate(),
    grossRevenue,
    totalCommission,
    paidCommission,
    pendingCommission: totalCommission - paidCommission,
    bookings: due.length,
    byVendor: [...byVendor.values()]
      .map((r) => ({ ...r, pending: r.total - r.paid }))
      .sort((a, b) => b.total - a.total),
  };
};

export const commissionBookings = async (
  period?: string,
  from?: string,
  to?: string,
  statusRaw?: string,
) => {
  const range = resolveDateRange(period, from, to);
  const statusQ = statusRaw?.toUpperCase();
  const commissionStatus = statusQ === 'PAID' || statusQ === 'PENDING' ? statusQ : undefined;

  const rows = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      ...(range ? { createdAt: range } : {}),
      ...(commissionStatus ? { commissionStatus: commissionStatus as any } : {}),
    },
    select: {
      id: true, reference: true, totalAmount: true,
      commissionAmount: true, commissionStatus: true, commissionPaidAt: true, createdAt: true,
      slot: { select: { location: { select: { name: true, vendor: { select: { id: true, businessName: true } } } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return {
    items: rows.map((b) => ({
      id: b.id,
      reference: b.reference,
      totalAmount: Number(b.totalAmount),
      commissionAmount: Number(b.commissionAmount),
      commissionStatus: b.commissionStatus,
      commissionPaidAt: b.commissionPaidAt,
      createdAt: b.createdAt,
      vendorId: b.slot?.location?.vendor?.id ?? null,
      vendorName: b.slot?.location?.vendor?.businessName ?? '—',
      spaceName: b.slot?.location?.name ?? '—',
    })),
  };
};
