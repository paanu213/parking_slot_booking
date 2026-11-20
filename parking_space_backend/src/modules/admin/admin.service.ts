/**
 * Admin service — business logic for the admin portal: dashboard stats, vendor
 * approval/management, parking-space approval, slots, bookings, payments,
 * customers, amenities, admin-user management and commission settings.
 * All persistence goes through Prisma; no HTTP concerns live here.
 */
import { nanoid } from 'nanoid';
import { effectiveValidUntil } from '../../lib/qrValidity.js';
import { normalizePlate } from '@ps/types';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { BadRequest, Conflict, NotFound } from '../../lib/http.js';
import { hashPassword } from '../../lib/password.js';
import { calculateBookingAmount } from '../../lib/pricing.js';
import { getCommissionRate, setCommissionRate } from '../../lib/commission.js';
import { CALL_LIMIT_DEFS, getCallLimits, setCallLimits, type CallLimitName } from '../../lib/callLimits.js';
import { resolveDateRange } from '../../lib/dateRange.js';
import { storeImageBuffer, deleteImageByUrl, deleteDocumentByUrl } from '../../lib/images.js';
import { parsePendingEdits, mergePendingEdits } from '../../lib/pendingEdits.js';
import { decryptField, encryptField, hmacHash } from '../../lib/crypto.js';
import { getGateway } from '../../lib/paymentGateway/index.js';
import { generateStickerBatchPdf } from '../../lib/stickerPdf.js';
import { updateVehicle } from '../vehicles/vehicles.service.js';
import { createQrOrder } from '../qrOrders/qrOrders.service.js';
import { recordDetailChanges, getDetailsHistory } from '../../lib/detailsChangeLog.js';
import { getStickerPricePaise, setStickerPricePaise } from '../../lib/qrPricing.js';
import { activeStickerOf, lockVehicle, parseStickerCode, REPLACEMENT_BATCH_LABEL } from '../../lib/qrStickerRules.js';
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
  ReassignVehicleInput,
  GenerateQrBatchInput,
  UpdateQrBatchInput,
  AdminUpdateVehicleInput,
  AdminQrOrderDetailsInput,
  AdminCreateQrOrderInput,
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
    pendingSpaceEdits,
    rangeBookingsTotal,
    rangeBookingsConfirmed,
    rangeBookingsCancelled,
    rangeRevenueResult,
    recentBookings,
    recentPendingVendors,
    recentPendingSpaces,
    recentSpaceEdits,
    recentProfileEdits,
    pendingListingLeads,
    recentListingLeads,
  ] = await prisma.$transaction([
    prisma.vendor.count(),
    prisma.vendor.count({ where: { status: 'PENDING' } }),
    prisma.vendor.count({ where: { status: 'APPROVED' } }),
    prisma.vendor.count({ where: { pendingProfileData: { not: null } } }),
    prisma.parkingLocation.count(),
    prisma.parkingLocation.count({ where: { approvalStatus: 'PENDING_REVIEW' } }),
    prisma.parkingLocation.count({ where: { approvalStatus: 'APPROVED', isActive: true } }),
    // Approved spaces with vendor-submitted edits awaiting review
    prisma.parkingLocation.count({ where: { pendingData: { not: null } } }),
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
    prisma.parkingLocation.findMany({
      where: { pendingData: { not: null } },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: { vendor: { select: { businessName: true } } },
    }),
    prisma.vendor.findMany({
      where: { pendingProfileData: { not: null } },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { fullName: true, email: true } } },
    }),
    // "List your space" submissions from the customer site awaiting review.
    prisma.vendorLead.count({ where: { status: 'PENDING', leadType: 'PARKING' } }),
    prisma.vendorLead.findMany({
      where: { status: 'PENDING', leadType: 'PARKING' },
      take: 2,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    vendors: { total: totalVendors, pending: pendingVendors, approved: approvedVendors, pendingProfileEdits },
    spaces:  { total: totalSpaces,  pending: pendingSpaces,  approved: approvedSpaces, pendingEdits: pendingSpaceEdits },
    leads:   { pending: pendingListingLeads },
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
      spaceEdits:     recentSpaceEdits,
      profileEdits:   recentProfileEdits,
      listingLeads:   recentListingLeads,
    },
  };
};

// ── Vendors ─────────────────────────────────────────────────────────────────
export const listVendors = async (status?: string) => {
  const items = await prisma.vendor.findMany({
    where: status ? { status: status as any } : {},
    include: {
      user: { select: { fullName: true, email: true, phone: true, status: true } },
      // Lightweight location data — used by admin UI for state/city filters
      // and to show which location(s) matched an active filter.
      locations: { select: { state: true, city: true, area: true } },
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
  // Profile edits accumulate as a LIST of requests; merge them (later wins per
  // field) into the final state to apply.
  const requests = parsePendingEdits(vendor.pendingProfileData as string | null);
  const pending = mergePendingEdits(requests);

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
  // Preserve the full edit history (every request) beyond clearing pendingData.
  await prisma.auditLog.create({
    data: {
      actorId, action: 'VENDOR_PROFILE_APPROVE', entity: 'Vendor', entityId: vendor.id,
      metadata: JSON.stringify({ decision: 'APPROVED', requests, appliedFields: Object.keys(pending) }),
    },
  });
  return updated;
};

export const rejectVendorProfile = async (id: string, actorId: string, note?: string) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id } });
  const requests = parsePendingEdits(vendor.pendingProfileData as string | null);
  // Delete any newly-uploaded aadhar docs (from any request) since none are used.
  const docs = new Set<string>();
  for (const r of requests) {
    const url = String((r.data as Record<string, unknown>)?.aadharDocUrl ?? '').trim();
    if (url && url !== vendor.aadharDocUrl) docs.add(url);
  }
  for (const url of docs) await deleteDocumentByUrl(url).catch(() => {});

  const updated = await prisma.vendor.update({
    where: { id },
    data: { pendingProfileData: null, rejectionNote: note ?? null },
    include: { user: { select: ADMIN_USER_SELECT } },
  });
  await prisma.auditLog.create({
    data: {
      actorId, action: 'VENDOR_PROFILE_REJECT', entity: 'Vendor', entityId: vendor.id,
      metadata: JSON.stringify({ decision: 'REJECTED', note: note ?? null, requests }),
    },
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
  // Apply every queued edit request (later requests win per field).
  const requests = parsePendingEdits(space.pendingData as string | null);
  const pendingEdits = mergePendingEdits(requests);
  const updated = await prisma.parkingLocation.update({
    where: { id },
    data: {
      ...pendingEdits,
      approvalStatus: 'APPROVED',
      approvalNote: null,
      pendingData: null,
      isActive: true,
      approvedAt: new Date(),
      approvedById: actorId,
    },
  });
  // Preserve the full edit history so it survives clearing pendingData: record
  // every submitted request (fields + submittedAt) plus the net applied fields.
  await prisma.auditLog.create({
    data: {
      actorId,
      action: requests.length ? 'SPACE_APPROVE_EDITS' : 'SPACE_APPROVE',
      entity: 'ParkingLocation',
      entityId: updated.id,
      metadata: requests.length
        ? JSON.stringify({ decision: 'APPROVED', requests, appliedFields: Object.keys(pendingEdits) })
        : null,
    },
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
  const space = await prisma.parkingLocation.findUniqueOrThrow({ where: { id } });
  // Capture the pending requests before clearing so the audit trail survives.
  const requests = parsePendingEdits(space.pendingData as string | null);
  const updated = await prisma.parkingLocation.update({
    where: { id },
    data: { pendingData: null, approvalNote: note ?? null },
  });
  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'SPACE_REJECT_EDITS',
      entity: 'ParkingLocation',
      entityId: updated.id,
      metadata: JSON.stringify({ decision: 'REJECTED', note: note ?? null, requests }),
    },
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
    // Only ever refund an actually-PAID attempt — a later FAILED/CREATED
    // retry row must never be the one that gets stamped REFUNDED.
    include: { payments: { where: { status: 'PAID' }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (amount > Number(booking.totalAmount)) {
    throw BadRequest('Refund amount cannot exceed total booking amount');
  }

  if (booking.isDirectBooking) {
    // Cash/offline booking — no online payment exists, nothing to refund at
    // a gateway; this is purely a bookkeeping record.
    const updated = await prisma.booking.update({
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

  // Online booking — must actually refund at the gateway before the DB ever
  // says REFUNDED. Never trust a client/admin click alone to mean money moved.
  const payment = booking.payments[0];
  if (!payment) throw BadRequest('No paid payment record found for this booking');
  if (!payment.providerPaymentId) throw BadRequest('Payment has no gateway reference, cannot refund');

  const gateway = getGateway();
  const refund = await gateway.refund({
    paymentId: payment.providerPaymentId,
    amountPaise: Math.round(amount * 100),
    notes: { bookingId: booking.id, reason: note ?? '' },
  });

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      refundAmount:     amount,
      refundedAt:       new Date(),
      refundNote:       note ?? null,
      status:           'REFUNDED',
      providerRefundId: refund.providerRefundId,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId, action: 'PAYMENT_REFUND',
      entity: 'Payment', entityId: payment.id,
      metadata: JSON.stringify({ amount, note, providerRefundId: refund.providerRefundId, gatewayStatus: refund.status }),
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

// ── QR Calling: global daily call cap (platform-wide, not per-vehicle) ────────
// Kept so the already-deployed admin UI's single "daily cap" card keeps working
// until it's replaced by the full call-limits card below.
export const getCallDailyCapSetting = async () => {
  const { perCarDailyCap } = await getCallLimits();
  return { dailyCap: perCarDailyCap };
};

export const updateCallDailyCapSetting = async (actorId: string, dailyCapRaw: number) => {
  const { perCarDailyCap } = await setCallLimits({ perCarDailyCap: Number(dailyCapRaw) });
  await prisma.auditLog.create({
    data: { actorId, action: 'QR_CALL_DAILY_CAP_UPDATE', entity: 'Setting', entityId: 'qr_call_daily_cap', metadata: JSON.stringify({ dailyCap: perCarDailyCap }) },
  });
  return { dailyCap: perCarDailyCap };
};

// ── QR Calling: all call limits (abuse/cost guards), admin-configurable ───────
const callLimitsView = async () => {
  const values = await getCallLimits();
  return {
    items: (Object.keys(CALL_LIMIT_DEFS) as CallLimitName[]).map((name) => {
      const { key: _key, ...def } = CALL_LIMIT_DEFS[name];
      return { name, ...def, value: values[name] };
    }),
  };
};

export const getCallLimitsSetting = callLimitsView;

export const updateCallLimitsSetting = async (actorId: string, patch: Partial<Record<CallLimitName, number>>) => {
  const before = await getCallLimits();
  const after = await setCallLimits(patch);
  await prisma.auditLog.create({
    data: { actorId, action: 'QR_CALL_LIMITS_UPDATE', entity: 'Setting', entityId: 'qr_call_limits', metadata: JSON.stringify({ before, after }) },
  });
  return callLimitsView();
};

/** QR sticker price (pack of 2). Applies to orders created from now on; existing orders keep their own price. */
export const getQrPricingSetting = async () => ({ stickerPricePaise: await getStickerPricePaise() });

export const updateQrPricingSetting = async (actorId: string, stickerPrice: number) => {
  const before = await getStickerPricePaise();
  const after = await setStickerPricePaise(stickerPrice * 100);
  await prisma.auditLog.create({
    data: {
      actorId, action: 'QR_STICKER_PRICE_UPDATE', entity: 'Setting', entityId: 'qr_sticker_price_paise',
      metadata: JSON.stringify({ fromPaise: before, toPaise: after }),
    },
  });
  return { stickerPricePaise: after };
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
      vendorName: b.slot?.location?.vendor?.businessName ?? '-',
      spaceName: b.slot?.location?.name ?? '-',
    })),
  };
};

// ── QR Calling — admin console ──────────────────────────────────────────────
// Registrations, dispute reassignment, call log / abuse review, spend.
// Same convention as the rest of this file: bounded `take`, no cursor paging.
// Plate/phone/medical-notes are application-encrypted (lib/crypto.ts) — every
// list here decrypts for display, which is why plate/owner-name search below
// runs in memory after decrypt rather than as a SQL `contains`.

const qrMaskPhone = (p: string): string => (p.length > 4 ? `••••${p.slice(-4)}` : '••••');

export const qrOverview = async () => {
  const today = resolveDateRange('day')!;
  const last30Days = { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };

  const [
    totalRegistrations, activeRegistrations, pausedRegistrations, emergencyEnabled,
    callsToday, callsTotal, answeredTotal, failedTotal, blockedNumbersCount,
    durationAgg, spendTodayAgg, busiestCarsRaw, topCallersRaw,
    revenueAgg, refundAgg,
  ] = await Promise.all([
    prisma.vehicleRegistration.count({ where: { status: { not: 'DELETED' } } }),
    prisma.vehicleRegistration.count({ where: { status: 'ACTIVE' } }),
    prisma.vehicleRegistration.count({ where: { status: 'PAUSED' } }),
    prisma.vehicleRegistration.count({ where: { status: { not: 'DELETED' }, emergencyPublic: true } }),
    prisma.callSession.count({ where: { createdAt: { gte: today.gte, lte: today.lte } } }),
    prisma.callSession.count(),
    prisma.callSession.count({ where: { answeredAt: { not: null } } }),
    prisma.callSession.count({ where: { status: { in: ['FAILED', 'NO_ANSWER', 'BUSY', 'OWNER_REJECTED', 'BLOCKED'] } } }),
    prisma.blockedNumber.count(),
    prisma.callSession.aggregate({ _avg: { durationSec: true }, where: { durationSec: { not: null } } }),
    prisma.callSession.aggregate({ _sum: { costPaise: true }, where: { createdAt: { gte: today.gte, lte: today.lte } } }),
    prisma.callSession.groupBy({
      by: ['registrationId'],
      _count: { _all: true },
      orderBy: { _count: { registrationId: 'desc' } },
      take: 5,
    }),
    prisma.callSession.groupBy({
      by: ['callerPhoneHash'],
      where: { callerPhoneHash: { not: null }, createdAt: last30Days },
      _count: { _all: true },
      orderBy: { _count: { callerPhoneHash: 'desc' } },
      take: 5,
    }),
    // Gross intake from sticker orders — PAID and REFUNDED both actually
    // received the money at checkout; refundedPaise below is what went back out.
    prisma.qrOrder.aggregate({
      where: { paymentStatus: { in: ['PAID', 'REFUNDED'] } },
      _sum: { stickerPricePaise: true, monthlyPricePaise: true },
    }),
    prisma.payment.aggregate({
      where: { qrOrderId: { not: null }, refundAmount: { not: null } },
      _sum: { refundAmount: true },
    }),
  ]);

  const busiestCars = await Promise.all(
    busiestCarsRaw.map(async (g) => {
      const reg = await prisma.vehicleRegistration.findUnique({ where: { id: g.registrationId } });
      return { registrationId: g.registrationId, plate: reg ? decryptField(reg.plateNumber) : '-', calls: g._count._all };
    }),
  );

  const topCallers = await Promise.all(
    topCallersRaw
      .filter((g): g is typeof g & { callerPhoneHash: string } => !!g.callerPhoneHash)
      .map(async (g) => {
        const sample = await prisma.callSession.findFirst({
          where:   { callerPhoneHash: g.callerPhoneHash },
          orderBy: { createdAt: 'desc' },
        });
        return {
          callerPhoneHash: g.callerPhoneHash,
          callerMasked:    sample ? qrMaskPhone(decryptField(sample.callerPhone)) : '••••',
          calls:           g._count._all,
          sampleCallId:    sample?.id ?? null,
        };
      }),
  );

  return {
    totalRegistrations, activeRegistrations, pausedRegistrations, emergencyEnabled,
    callsToday, callsTotal,
    answerRate:     callsTotal > 0 ? Math.round((answeredTotal / callsTotal) * 100) : 0,
    avgDurationSec: durationAgg._avg.durationSec ? Math.round(durationAgg._avg.durationSec) : 0,
    failedTotal, blockedNumbersCount,
    spendTodayPaise: spendTodayAgg._sum.costPaise ?? 0,
    revenuePaise: (revenueAgg._sum.stickerPricePaise ?? 0) + (revenueAgg._sum.monthlyPricePaise ?? 0),
    refundedPaise: Math.round(Number(refundAgg._sum.refundAmount ?? 0) * 100),
    busiestCars, topCallers,
  };
};

type QrEmergencySource = {
  emergencyPublic: boolean;
  bloodGroup: string | null;
  medicalNotes: string | null;
  emergencyContacts: { id: string; name: string; relation: string | null; phone: string; showPublic: boolean; sortOrder: number }[];
};

/** Decrypted emergency (ICE) details — shown to admin whether or not the public card is switched on. */
const qrEmergencyView = (r: QrEmergencySource) => ({
  public:       r.emergencyPublic,
  bloodGroup:   r.bloodGroup,
  medicalNotes: r.medicalNotes ? decryptField(r.medicalNotes) : null,
  contacts: [...r.emergencyContacts]
    .sort((x, y) => x.sortOrder - y.sortOrder)
    .map((c) => ({ id: c.id, name: c.name, relation: c.relation, phone: decryptField(c.phone), showPublic: c.showPublic })),
});

const textHit = (q: string, ...parts: (string | null | undefined)[]) =>
  parts.some((p) => (p ?? '').toLowerCase().includes(q));

export interface QrVehicleFilters {
  search?: string; status?: string; vehicleType?: string; city?: string; state?: string;
}

export const listQrVehicles = async (f: QrVehicleFilters = {}) => {
  const q = (f.search ?? '').trim().toLowerCase();
  // City/state only exist on the sticker order's shipping address, so a car
  // matches when any of its orders shipped to that city/state.
  const orderMatch = f.city || f.state
    ? { qrOrders: { some: { ...(f.city ? { city: f.city } : {}), ...(f.state ? { state: f.state } : {}) } } }
    : {};
  const rows = await prisma.vehicleRegistration.findMany({
    where: {
      ...(f.status ? { status: f.status as any } : { status: { not: 'DELETED' } }),
      ...(f.vehicleType ? { vehicleType: f.vehicleType as any } : {}),
      ...orderMatch,
    },
    include: {
      user:              { select: { id: true, fullName: true, email: true, phone: true } },
      emergencyContacts: { orderBy: { sortOrder: 'asc' } },
      qrOrders:          { orderBy: { createdAt: 'desc' }, take: 1, select: { city: true, state: true } },
      _count:            { select: { calls: true, emergencyContacts: true } },
    },
    orderBy: { createdAt: 'desc' },
    // Text search runs in memory over decrypted fields, so widen the window when searching.
    take: q ? 2000 : 300,
  });

  const items = rows.map((r) => ({
    id:                    r.id,
    plateNumber:           decryptField(r.plateNumber),
    vehicleType:           r.vehicleType,
    contactPhone:          decryptField(r.contactPhone),
    contactVerified:       r.contactVerified,
    status:                r.status,
    emergencyPublic:       r.emergencyPublic,
    ownerName:             r.ownerName,
    validUntil:            effectiveValidUntil(r),
    validityCustom:        r.validUntil !== null,
    callCount:             r._count.calls,
    emergencyContactCount: r._count.emergencyContacts,
    emergency:             qrEmergencyView(r),
    city:                  r.qrOrders[0]?.city ?? null,
    state:                 r.qrOrders[0]?.state ?? null,
    owner:                 r.user,
    createdAt:             r.createdAt,
  }));

  if (!q) return { items };
  return {
    items: items.filter((v) =>
      textHit(q, v.plateNumber, v.contactPhone, v.ownerName, v.owner.email, v.owner.fullName, v.owner.phone, v.city, v.state)
      || v.emergency.contacts.some((c) => textHit(q, c.name, c.phone)),
    ).slice(0, 300),
  };
};

export const getQrVehicle = async (id: string) => {
  const r = await prisma.vehicleRegistration.findUnique({
    where:   { id },
    include: {
      user:              { select: { id: true, fullName: true, email: true, phone: true } },
      emergencyContacts: { orderBy: { sortOrder: 'asc' } },
      qrOrders:          { orderBy: { createdAt: 'desc' }, take: 1, select: { city: true, state: true } },
      qrStickers:        { where: { status: 'CLAIMED' }, orderBy: { claimedAt: 'desc' }, take: 1, select: { token: true, claimedAt: true, batch: { select: { id: true, label: true } } } },
      calls:             { orderBy: { initiatedAt: 'desc' }, take: 50 },
    },
  });
  if (!r) throw NotFound('Vehicle not found');

  return {
    id:              r.id,
    plateNumber:     decryptField(r.plateNumber),
    vehicleType:     r.vehicleType,
    contactPhone:    decryptField(r.contactPhone),
    contactVerified: r.contactVerified,
    status:          r.status,
    isActive:        r.isActive,
    silentFrom:      r.silentFrom,
    silentTo:        r.silentTo,
    emergencyPublic: r.emergencyPublic,
    ownerName:       r.ownerName,
    bloodGroup:      r.bloodGroup,
    medicalNotes:    r.medicalNotes ? decryptField(r.medicalNotes) : null,
    validUntil:      effectiveValidUntil(r),
    validityCustom:  r.validUntil !== null,
    city:            r.qrOrders[0]?.city ?? null,
    state:           r.qrOrders[0]?.state ?? null,
    owner:           r.user,
    linkedSticker:   r.qrStickers[0]
      ? { token: r.qrStickers[0].token, url: stickerUrl(r.qrStickers[0].token), claimedAt: r.qrStickers[0].claimedAt, batch: r.qrStickers[0].batch }
      : null,
    emergencyContacts: r.emergencyContacts.map((c) => ({
      id: c.id, name: c.name, relation: c.relation, phone: decryptField(c.phone), showPublic: c.showPublic,
    })),
    calls: r.calls.map((c) => ({
      id: c.id, status: c.status, provider: c.provider,
      initiatedAt: c.initiatedAt, answeredAt: c.answeredAt, endedAt: c.endedAt, durationSec: c.durationSec,
      callerMasked: qrMaskPhone(decryptField(c.callerPhone)),
    })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
};

/**
 * Read-only Exotel health check, run from the server it's called on (so it
 * reveals what production sees): outbound IP, credential fingerprints, and
 * whether Exotel accepts this server for non-calling API requests. Places no call.
 */
export const exotelDiagnostics = async () => {
  const { createHash } = await import('node:crypto');
  const fp = (v?: string) => (v ? createHash('sha256').update(v).digest('hex').slice(0, 8) : null);
  const auth = 'Basic ' + Buffer.from(`${env.EXOTEL_API_KEY}:${env.EXOTEL_API_TOKEN}`).toString('base64');
  const base = `https://${env.EXOTEL_SUBDOMAIN}/v1/Accounts/${env.EXOTEL_ACCOUNT_SID}`;

  const probe = async (url: string, init?: RequestInit) => {
    try {
      const r = await fetch(url, init);
      return { status: r.status, via: r.headers.get('server'), body: (await r.text()).slice(0, 300) };
    } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  };

  return {
    nodeVersion: process.version,
    nodeEnv: env.NODE_ENV,
    provider: env.CALL_PROVIDER,
    config: {
      accountSid: env.EXOTEL_ACCOUNT_SID, subdomain: env.EXOTEL_SUBDOMAIN,
      apiKeyFp: fp(env.EXOTEL_API_KEY), apiTokenFp: fp(env.EXOTEL_API_TOKEN),
      apiKeyLen: env.EXOTEL_API_KEY?.length, apiTokenLen: env.EXOTEL_API_TOKEN?.length,
      virtualNumbers: env.EXOTEL_VIRTUAL_NUMBERS, apiBaseUrl: env.API_BASE_URL,
      webhookSecretSet: !!env.EXOTEL_WEBHOOK_SECRET,
    },
    egressIp: await probe('https://api.ipify.org?format=json'),
    exotelListNumbers: await probe(`${base}/IncomingPhoneNumbers.json`, { headers: { Authorization: auth } }),
  };
};

/** Every state/city that has a sticker order — feeds the admin's searchable filter dropdowns. */
export const qrFilterOptions = async () => {
  const rows = await prisma.qrOrder.groupBy({ by: ['state', 'city'], orderBy: [{ state: 'asc' }, { city: 'asc' }] });
  return { locations: rows.map((r) => ({ state: r.state, city: r.city })) };
};

/**
 * Admin edit of a registered customer's details: car number, vehicle type,
 * contact number, owner name, silent hours, the emergency (ICE) card and
 * contacts, and the account holder's name/phone. Everything is validated and
 * checked for clashes BEFORE anything is written, so a rejected edit never
 * leaves a half-applied change.
 */
export const adminUpdateQrVehicle = async (id: string, actorId: string, input: AdminUpdateVehicleInput) => {
  const reg = await prisma.vehicleRegistration.findUnique({ where: { id } });
  if (!reg) throw NotFound('Vehicle not found');
  if (reg.status === 'DELETED') throw BadRequest('This registration has been deleted');

  const { plateNumber, customer, ...profile } = input;

  // Plate: re-hash + re-encrypt, and keep the unique plateHash honest.
  let plateChange: { plateHash: string; plateNumber: string; clearDupId: string | null } | null = null;
  if (plateNumber !== undefined) {
    const plateHash = hmacHash(plateNumber); // already normalized by the schema transform
    if (plateHash !== reg.plateHash) {
      const dup = await prisma.vehicleRegistration.findUnique({ where: { plateHash } });
      if (dup && dup.id !== id && dup.status !== 'DELETED') {
        throw Conflict('Another registration already uses this car number');
      }
      plateChange = { plateHash, plateNumber: encryptField(plateNumber), clearDupId: dup && dup.status === 'DELETED' ? dup.id : null };
    }
  }

  // Account holder: phone is unique across users.
  if (customer?.phone) {
    const other = await prisma.user.findUnique({ where: { phone: customer.phone } });
    if (other && other.id !== reg.userId) throw Conflict('Another account already uses that phone number');
  }

  // Change history for the plate and the account holder (before the write, so old values are captured).
  const accountBefore = customer ? await prisma.user.findUnique({ where: { id: reg.userId }, select: { fullName: true, phone: true } }) : null;

  await prisma.$transaction(async (tx) => {
    if (plateChange) {
      // A soft-deleted row still occupies the unique hash — clear it, same as registerVehicle does.
      if (plateChange.clearDupId) await tx.vehicleRegistration.delete({ where: { id: plateChange.clearDupId } });
      await tx.vehicleRegistration.update({ where: { id }, data: { plateHash: plateChange.plateHash, plateNumber: plateChange.plateNumber } });
    }
    if (customer && (customer.fullName !== undefined || customer.phone !== undefined)) {
      await tx.user.update({
        where: { id: reg.userId },
        data: {
          ...(customer.fullName !== undefined ? { fullName: customer.fullName } : {}),
          ...(customer.phone !== undefined ? { phone: customer.phone } : {}),
        },
      });
    }
  });

  if (plateChange && plateNumber !== undefined) {
    await recordDetailChanges({
      actorId, entity: 'VehicleRegistration', entityId: id,
      changes: [{ field: 'plateNumber', label: 'Number plate', from: decryptField(reg.plateNumber), to: plateNumber }],
    });
  }
  if (customer && accountBefore) {
    await recordDetailChanges({
      actorId, entity: 'User', entityId: reg.userId,
      changes: [
        ...(customer.fullName !== undefined ? [{ field: 'accountName', label: 'Account name', from: accountBefore.fullName, to: customer.fullName }] : []),
        ...(customer.phone !== undefined ? [{ field: 'accountPhone', label: 'Account mobile', from: accountBefore.phone, to: customer.phone }] : []),
      ],
    });
  }

  // Everything else reuses the owner's own update path (same encryption, same ICE-list replace).
  if (Object.keys(profile).length > 0) await updateVehicle(reg.userId, id, profile, actorId);

  // (Delivery name/phone on this vehicle's orders are kept in step inside updateVehicle.)

  await prisma.auditLog.create({
    data: {
      actorId, action: 'QR_VEHICLE_ADMIN_EDIT', entity: 'VehicleRegistration', entityId: id,
      // Field names only — never the (encrypted) values themselves.
      metadata: JSON.stringify({
        fields: [
          ...(plateNumber !== undefined ? ['plateNumber'] : []),
          ...(customer ? Object.keys(customer).map((k) => `customer.${k}`) : []),
          ...Object.keys(profile),
        ],
      }),
    },
  });

  return getQrVehicle(id);
};

/** Dispute resolution — plate belongs to a different real owner than whoever registered it first. */
export const reassignQrVehicle = async (id: string, actorId: string, input: ReassignVehicleInput) => {
  const registration = await prisma.vehicleRegistration.findUnique({ where: { id } });
  if (!registration) throw NotFound('Vehicle not found');

  const newOwner = await prisma.user.findUnique({ where: { email: input.ownerEmail } });
  if (!newOwner) throw NotFound('No account found with that email, the new owner needs an AutoSahay account first');
  if (newOwner.id === registration.userId) throw Conflict('This car is already registered to that account');

  const updated = await prisma.vehicleRegistration.update({ where: { id }, data: { userId: newOwner.id } });

  await prisma.auditLog.create({
    data: {
      actorId,
      action:   'QR_VEHICLE_REASSIGN',
      entity:   'VehicleRegistration',
      entityId: id,
      metadata: JSON.stringify({ fromUserId: registration.userId, toUserId: newOwner.id, note: input.note ?? null }),
    },
  });

  return getQrVehicle(updated.id);
};

/**
 * Sets (or clears, with `null`) the QR sticker's validity end date for this
 * car — the one-time sticker fee is valid 10 years by default; this is the
 * individual-terms override. Past the date, scan.service treats the sticker
 * like a paused registration (calls stop resolving) until admin extends or
 * clears it again.
 */
export const setVehicleValidity = async (id: string, actorId: string, validUntil: Date | null) => {
  const registration = await prisma.vehicleRegistration.findUnique({ where: { id } });
  if (!registration) throw NotFound('Vehicle not found');

  const updated = await prisma.vehicleRegistration.update({ where: { id }, data: { validUntil } });

  await prisma.auditLog.create({
    data: {
      actorId,
      action:   'QR_VEHICLE_SET_VALIDITY',
      entity:   'VehicleRegistration',
      entityId: id,
      metadata: JSON.stringify({ from: registration.validUntil, to: validUntil }),
    },
  });

  return getQrVehicle(updated.id);
};

/** Admin pause/resume — same effect as the owner's own toggle in My Vehicles. */
export const setQrVehicleStatus = async (id: string, actorId: string, status: 'ACTIVE' | 'PAUSED') => {
  const registration = await prisma.vehicleRegistration.findUnique({ where: { id } });
  if (!registration) throw NotFound('Vehicle not found');
  if (registration.status === 'DELETED') throw BadRequest('This registration has been deleted');

  const updated = await prisma.vehicleRegistration.update({
    where: { id },
    data:  { status, isActive: status === 'ACTIVE' },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action:   status === 'PAUSED' ? 'QR_VEHICLE_PAUSE' : 'QR_VEHICLE_RESUME',
      entity:   'VehicleRegistration',
      entityId: id,
    },
  });

  return getQrVehicle(updated.id);
};

/** Admin correcting the number a scan rings — e.g. the owner lost that phone. */
export const updateQrVehicleContact = async (id: string, actorId: string, contactPhone: string) => {
  const registration = await prisma.vehicleRegistration.findUnique({ where: { id } });
  if (!registration) throw NotFound('Vehicle not found');
  if (registration.status === 'DELETED') throw BadRequest('This registration has been deleted');

  const updated = await prisma.vehicleRegistration.update({
    where: { id },
    data:  { contactPhone: encryptField(contactPhone) },
  });

  await prisma.auditLog.create({
    data: { actorId, action: 'QR_VEHICLE_CONTACT_UPDATE', entity: 'VehicleRegistration', entityId: id },
  });

  return getQrVehicle(updated.id);
};

export const listQrCalls = async (statusFilter?: string) => {
  const rows = await prisma.callSession.findMany({
    where: statusFilter ? { status: statusFilter as any } : {},
    include: {
      registration: { select: { plateNumber: true, user: { select: { email: true } } } },
    },
    orderBy: { initiatedAt: 'desc' },
    take: 500,
  });

  return {
    items: rows.map((c) => ({
      id:           c.id,
      status:       c.status,
      provider:     c.provider,
      initiatedAt:  c.initiatedAt,
      answeredAt:   c.answeredAt,
      endedAt:      c.endedAt,
      durationSec:  c.durationSec,
      costPaise:    c.costPaise,
      callerMasked: qrMaskPhone(decryptField(c.callerPhone)),
      plate:        decryptField(c.registration.plateNumber),
      ownerEmail:   c.registration.user.email,
    })),
  };
};

/**
 * On-demand reveal of a caller's full number (normally shown masked to
 * everyone except when explicitly requested). Never bulk-shipped in list
 * responses — one call, one row, logged to the audit trail each time so
 * there's a record of who looked up a customer's number and when.
 */
export const revealQrCallerNumber = async (callId: string, actorId: string) => {
  const session = await prisma.callSession.findUnique({ where: { id: callId } });
  if (!session) throw NotFound('Call not found');
  const callerNumber = decryptField(session.callerPhone);
  await prisma.auditLog.create({
    data: { actorId, action: 'QR_CALLER_NUMBER_REVEAL', entity: 'CallSession', entityId: callId },
  });
  return { callerNumber };
};

/** Admin-side global block — scoped to a specific call so no raw phone entry is needed. */
export const blockQrCallGlobally = async (callId: string, actorId: string, reason?: string) => {
  const session = await prisma.callSession.findUnique({ where: { id: callId } });
  if (!session || !session.callerPhoneHash) throw NotFound('Call not found');

  const existing = await prisma.blockedNumber.findFirst({
    where: { phoneHash: session.callerPhoneHash, scope: 'GLOBAL' },
  });
  if (!existing) {
    await prisma.blockedNumber.create({
      data: { phoneHash: session.callerPhoneHash, scope: 'GLOBAL', reason: reason ?? null, createdById: actorId },
    });
    await prisma.auditLog.create({
      data: { actorId, action: 'QR_NUMBER_BLOCK_GLOBAL', entity: 'CallSession', entityId: callId },
    });
  }
  return { blocked: true };
};

// BlockedNumber has no Prisma relations (plain registrationId/createdById
// columns) — resolve display names with a couple of batched lookups instead.
export const listQrBlockedNumbers = async () => {
  const rows = await prisma.blockedNumber.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });

  const regIds   = [...new Set(rows.map((r) => r.registrationId).filter((x): x is string => !!x))];
  const adminIds = [...new Set(rows.map((r) => r.createdById).filter((x): x is string => !!x))];

  const [regs, admins] = await Promise.all([
    regIds.length   ? prisma.vehicleRegistration.findMany({ where: { id: { in: regIds } } }) : Promise.resolve([]),
    adminIds.length ? prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
  ]);
  const regMap   = new Map(regs.map((r) => [r.id, decryptField(r.plateNumber)]));
  const adminMap = new Map(admins.map((a) => [a.id, a.fullName]));

  return {
    items: rows.map((r) => ({
      id:        r.id,
      scope:     r.scope,
      reason:    r.reason,
      plate:     r.registrationId ? (regMap.get(r.registrationId) ?? '-') : null,
      blockedBy: r.createdById ? (adminMap.get(r.createdById) ?? '-') : 'Owner',
      createdAt: r.createdAt,
    })),
  };
};

export const unblockQrNumber = async (id: string, actorId: string) => {
  const row = await prisma.blockedNumber.findUnique({ where: { id } });
  if (!row) throw NotFound('Block entry not found');
  await prisma.blockedNumber.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId, action: 'QR_NUMBER_UNBLOCK', entity: 'BlockedNumber', entityId: id },
  });
  return { unblocked: true };
};

// ── QR sticker requests — fulfilment queue ──────────────────────────────────
// Requests come in with no online charge (payment paused sitewide); admin
// confirms payment was collected offline, then ships.

export interface QrOrderFilters {
  status?: string; paymentStatus?: string; q?: string; vehicleType?: string; city?: string; state?: string;
  channel?: string; // order type: WEBSITE, INFLUENCER, CAMPAIGN, SUPPORT, OFFLINE_SALE, OTHER
}

export const listQrOrders = async (params: QrOrderFilters) => {
  const { status, paymentStatus } = params;
  const q = (params.q ?? '').trim().toLowerCase();
  // paymentStatus accepts a comma-separated list (e.g. "PAID,REFUNDED") so the
  // fulfilment queue can show both without a second round trip.
  const paymentStatuses = paymentStatus ? paymentStatus.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const rows = await prisma.qrOrder.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(paymentStatuses ? { paymentStatus: { in: paymentStatuses as any } } : {}),
      ...(params.city ? { city: params.city } : {}),
      ...(params.channel ? { channel: params.channel as any } : {}),
      ...(params.state ? { state: params.state } : {}),
      ...(params.vehicleType ? { registration: { vehicleType: params.vehicleType as any } } : {}),
    },
    include: {
      user: { select: { fullName: true, email: true, phone: true } },
      registration: {
        select: {
          id: true,
          plateNumber: true,
          contactPhone: true,
          vehicleType: true,
          emergencyPublic: true,
          bloodGroup: true,
          medicalNotes: true,
          emergencyContacts: { orderBy: { sortOrder: 'asc' } },
          // Most recently claimed sticker for this car — whether the
          // physical sticker has actually been scanned + configured yet is
          // separate from order fulfilment (a delivered sticker can sit
          // unscanned for a while before the owner sets it up).
          qrStickers: {
            where:   { status: 'CLAIMED' },
            orderBy: { claimedAt: 'desc' },
            take:    1,
            select:  { token: true, claimedAt: true, batch: { select: { id: true, label: true } } },
          },
        },
      },
      // Which physical sticker admin recorded as put in the package — set at
      // dispatch time, independent of whether the customer has since claimed it.
      dispatchedSticker: { select: { token: true, batch: { select: { id: true, label: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    // Text search runs in memory over decrypted fields, so widen the window when searching.
    take: q ? 2000 : 300,
  });

  const fulfilment = await qrOrderFulfilmentCounts(rows.map((r) => r.id));

  const items = rows.map((r) => {
    const sticker = r.registration?.qrStickers?.[0] ?? null;
    // The QR this customer's car answers to: the claimed one, else the one recorded at dispatch.
    const stickerToken = sticker?.token ?? r.dispatchedSticker?.token ?? null;
    const stickerBatch = (sticker ? sticker.batch : r.dispatchedSticker?.batch) ?? null;
    return {
      id:                r.id,
      registrationId:    r.registration?.id ?? null,
      status:            r.status,
      paymentStatus:     r.paymentStatus,
      paidAt:            r.paidAt,
      paymentRef:        r.paymentRef,
      stickerPricePaise: r.stickerPricePaise,
      monthlyPricePaise: r.monthlyPricePaise,
      plate:             r.registration ? decryptField(r.registration.plateNumber) : null,
      vehicleType:       r.registration?.vehicleType ?? null,
      emergency:         r.registration ? qrEmergencyView(r.registration) : null,
      ownerName:         r.user.fullName,
      ownerEmail:        r.user.email,
      ownerPhone:        r.user.phone,
      // The number that rings when the QR is scanned (masked calls). Not the account or delivery phone.
      scanPhone:         r.registration ? decryptField(r.registration.contactPhone) : null,
      shippingName:      r.shippingName,
      shippingPhone:     r.shippingPhone,
      addressLine:       r.addressLine,
      city:              r.city,
      state:             r.state,
      pincode:           r.pincode,
      note:              r.note,
      confirmedAt:       r.confirmedAt,
      pickedUpAt:        r.pickedUpAt,
      outForDeliveryAt:  r.outForDeliveryAt,
      deliveredAt:       r.deliveredAt,
      returnedAt:        r.returnedAt,
      deliveryAttempt:   r.deliveryAttempt,
      qrConfigured:      !!sticker,
      qrToken:           sticker?.token ?? null,
      qrConfiguredAt:    sticker?.claimedAt ?? null,
      dispatchedStickerToken: r.dispatchedSticker?.token ?? null,
      dispatchedAt:           r.dispatchedAt,
      stickerToken,
      stickerUrl:        stickerToken ? stickerUrl(stickerToken) : null,
      stickerBatch,      // { id, label } of the QR batch this sticker was printed in
      source:            r.source,
      channel:           r.channel,
      paymentMode:       r.paymentMode,
      fulfilment:        fulfilment.get(r.id) ?? { delivered: 0, returned: 0, replacements: 0 },
      createdAt:         r.createdAt,
    };
  });

  if (!q) return { items };
  return {
    items: items.filter((o) =>
      textHit(q, o.plate, o.ownerName, o.ownerEmail, o.ownerPhone, o.shippingName, o.shippingPhone, o.addressLine,
        o.city, o.state, o.pincode, o.paymentRef, o.qrToken, o.dispatchedStickerToken)
      || (o.emergency?.contacts ?? []).some((c) => textHit(q, c.name, c.phone)),
    ).slice(0, 300),
  };
};

/** Admin correcting an order's shipping details — wrong address, phone, pincode, etc. */
export const adminUpdateQrOrderDetails = async (id: string, actorId: string, input: AdminQrOrderDetailsInput) => {
  const order = await prisma.qrOrder.findUnique({ where: { id } });
  if (!order) throw NotFound('Order not found');
  const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length === 0) throw BadRequest('Nothing to update');

  await prisma.$transaction([
    prisma.qrOrder.update({ where: { id }, data }),
    prisma.auditLog.create({
      data: { actorId, action: 'QR_ORDER_DETAILS_EDIT', entity: 'QrOrder', entityId: id, metadata: JSON.stringify({ fields: Object.keys(data) }) },
    }),
  ]);
  return { ok: true };
};

/**
 * Records which physical sticker (by its printed code) went into the package
 * for this order. Guards against every mapping mistake we know of:
 *  - the order must be paid and active (not pending, not cancelled);
 *  - once the order's vehicle has a QR set up, the code can't be swapped here
 *    (that would leave the order pointing at a sticker the car doesn't use);
 *    a different code goes through "Replace QR code";
 *  - a disabled sticker, a sticker set up on another vehicle, or one already
 *    recorded for another order is refused;
 *  - correcting a wrong code before setup frees the old code back to stock
 *    automatically, and the change is logged "from A to B".
 * Accepts the printed code or a full scanned sticker URL.
 */
export const dispatchQrOrderSticker = async (id: string, actorId: string, rawToken: string) => {
  const token = parseStickerCode(rawToken);
  const order = await prisma.qrOrder.findUnique({
    where:   { id },
    include: {
      dispatchedSticker: { select: { id: true, token: true } },
      registration: {
        select: { id: true, plateNumber: true, qrStickers: { where: { status: 'CLAIMED' }, take: 1, select: { id: true, token: true } } },
      },
    },
  });
  if (!order) throw NotFound('Order not found');
  if (order.paymentStatus !== 'PAID' || order.status === 'PENDING' || order.status === 'CANCELLED') {
    throw BadRequest('A sticker can only be recorded for a paid, active order');
  }

  const plate = order.registration ? decryptField(order.registration.plateNumber) : 'this vehicle';
  const linked = order.registration?.qrStickers[0] ?? null;
  if (linked && linked.token !== token) {
    throw Conflict(`${plate} already has QR ${linked.token} set up, so the code can't be changed here. Ship a reprint of ${linked.token}, or use "Replace QR code" to issue a new one.`);
  }
  if (order.dispatchedSticker?.token === token) return order; // nothing to change

  const sticker = await prisma.qrSticker.findUnique({
    where:   { token },
    include: {
      dispatchedFor: { select: { id: true } },
      registration:  { select: { plateNumber: true } },
    },
  });
  if (!sticker) throw NotFound(`No sticker found with code ${token}`);
  if (sticker.status === 'DISABLED') throw BadRequest(`Sticker ${token} is disabled. Pick another sticker from stock.`);
  if (sticker.status === 'CLAIMED' && sticker.registrationId && sticker.registrationId !== order.registrationId) {
    const other = sticker.registration ? decryptField(sticker.registration.plateNumber) : 'another vehicle';
    throw Conflict(`Sticker ${token} is already linked to ${other}. Pick an unused sticker.`);
  }
  if (sticker.dispatchedFor && sticker.dispatchedFor.id !== id) {
    throw Conflict(linked
      ? `QR ${token} was already recorded on an earlier order for ${plate}. This order ships a reprint of it, nothing more to record.`
      : `Sticker ${token} is already recorded against another order. Pick an unused sticker.`);
  }

  const previous = order.dispatchedSticker;
  const note = previous
    ? `Sticker code changed from ${previous.token} to ${sticker.token}, ${previous.token} is back in stock`
    : `Sticker ${sticker.token} recorded as dispatched`;
  try {
    const [updated] = await prisma.$transaction([
      prisma.qrOrder.update({
        where: { id },
        data: { dispatchedStickerId: sticker.id, dispatchedAt: new Date() },
      }),
      prisma.qrOrderStatusEvent.create({ data: { qrOrderId: id, status: order.status, actorId, note } }),
      prisma.auditLog.create({
        data: {
          actorId, action: previous ? 'QR_ORDER_STICKER_CHANGED' : 'QR_ORDER_STICKER_DISPATCHED', entity: 'QrOrder', entityId: id,
          metadata: JSON.stringify({ token: sticker.token, from: previous?.token ?? null }),
        },
      }),
    ]);
    return updated;
  } catch (e) {
    // Unique index on dispatchedStickerId: someone recorded it on another order a moment ago.
    if ((e as { code?: string }).code === 'P2002') throw Conflict(`Sticker ${token} was just recorded against another order`);
    throw e;
  }

};

/** Full fulfilment timeline for one order — every status change, oldest first. */
export const listQrOrderEvents = async (qrOrderId: string) => {
  const order = await prisma.qrOrder.findUnique({ where: { id: qrOrderId } });
  if (!order) throw NotFound('Order not found');

  const rows = await prisma.qrOrderStatusEvent.findMany({
    where:   { qrOrderId },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { fullName: true, email: true } } },
  });

  return {
    items: rows.map((e) => ({
      id:        e.id,
      status:    e.status,
      note:      e.note,
      createdAt: e.createdAt,
      actor:     e.actor ? { fullName: e.actor.fullName, email: e.actor.email } : null,
    })),
  };
};

/**
 * Every QR sticker payment attempt (success AND failure), with the customer
 * details a support agent needs to call about a stuck/failed payment —
 * name, email, both phone numbers on file, and the plate. Scoped to
 * qrOrderId != null so this never mixes in booking payments.
 */
export const listQrPayments = async (status?: string, searchRaw?: string) => {
  const search = (searchRaw ?? '').trim();
  const rows = await prisma.payment.findMany({
    where: {
      qrOrderId: { not: null },
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { providerOrderId:   { contains: search } },
              { providerPaymentId: { contains: search } },
              { qrOrder: { shippingPhone: { contains: search } } },
              { qrOrder: { shippingName:  { contains: search } } },
              { qrOrder: { user: { fullName: { contains: search } } } },
              { qrOrder: { user: { email:    { contains: search } } } },
              { qrOrder: { user: { phone:    { contains: search } } } },
            ],
          }
        : {}),
    },
    include: {
      qrOrder: {
        include: {
          user:         { select: { id: true, fullName: true, email: true, phone: true } },
          registration: { select: { plateNumber: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return {
    items: rows.map((p) => ({
      id:                 p.id,
      status:             p.status,
      provider:           p.provider,
      amount:             p.amount,
      currency:           p.currency,
      providerOrderId:    p.providerOrderId,
      providerPaymentId:  p.providerPaymentId,
      failureCode:        p.failureCode,
      failureReason:      p.failureReason,
      createdAt:          p.createdAt,
      updatedAt:          p.updatedAt,
      qrOrderId:          p.qrOrderId,
      customer: p.qrOrder
        ? {
            userId:        p.qrOrder.user.id,
            name:          p.qrOrder.user.fullName,
            email:         p.qrOrder.user.email,
            accountPhone:  p.qrOrder.user.phone,
            shippingPhone: p.qrOrder.shippingPhone,
            plate:         p.qrOrder.registration ? decryptField(p.qrOrder.registration.plateNumber) : null,
          }
        : null,
    })),
  };
};

/**
 * Fulfilment state machine. CONFIRMED is normally reached automatically the
 * moment payment succeeds (see qrOrders.service's confirmQrOrderOnPayment) —
 * admin only drives the physical pickup/dispatch/delivery stages from here,
 * plus the RETURNED -> CONFIRMED "resend" loop for damaged/misdelivered
 * stickers, which restarts pickup/dispatch/delivery from scratch.
 */
/**
 * After an order is cancelled or refunded, its dispatched sticker (if the
 * customer never set it up) must not stay usable for free:
 *  - never left us, or came back (CONFIRMED / RETURNED): back to stock;
 *  - with the customer (picked up / out for delivery / delivered): switched off.
 * A sticker already set up stays active; that is a support decision, and the
 * admin can disable it from QR stickers.
 */
const SHIPPED_STATUSES = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const settleStickerAfterCancel = async (orderId: string, actorId: string, previousStatus: string) => {
  const o = await prisma.qrOrder.findUnique({
    where:  { id: orderId },
    select: { dispatchedSticker: { select: { id: true, token: true, status: true } } },
  });
  const st = o?.dispatchedSticker;
  if (!st || st.status !== 'UNCLAIMED') return;
  const shipped = SHIPPED_STATUSES.includes(previousStatus);
  await prisma.$transaction([
    shipped
      ? prisma.qrSticker.update({ where: { id: st.id }, data: { status: 'DISABLED', disabledAt: new Date(), disabledReason: 'Order cancelled or refunded after dispatch' } })
      : prisma.qrOrder.update({ where: { id: orderId }, data: { dispatchedStickerId: null } }),
    prisma.qrOrderStatusEvent.create({
      data: { qrOrderId: orderId, status: 'CANCELLED', actorId, note: shipped ? `Sticker ${st.token} switched off` : `Sticker ${st.token} back in stock` },
    }),
    prisma.auditLog.create({
      data: { actorId, action: shipped ? 'QR_STICKER_DISABLE' : 'QR_ORDER_STICKER_RELEASED', entity: 'QrSticker', entityId: st.id, metadata: JSON.stringify({ orderId, reason: 'order cancelled' }) },
    }),
  ]);
};

const QR_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING:          ['CANCELLED'],
  CONFIRMED:        ['PICKED_UP', 'CANCELLED'],
  PICKED_UP:        ['OUT_FOR_DELIVERY', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED'],
  DELIVERED:        ['RETURNED'],
  RETURNED:         ['CONFIRMED'],
  CANCELLED:        [],
};

/** Change history (contact number, owner details, account mobile) for one registered vehicle. */
export const getQrVehicleHistory = async (id: string) => {
  const reg = await prisma.vehicleRegistration.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!reg) throw NotFound('Vehicle not found');
  return { items: await getDetailsHistory(reg.id, reg.userId) };
};

/** Customer lookup by email for the admin "New order" form. */
export const lookupQrCustomer = async (email: string) => {
  const user = await prisma.user.findUnique({
    where:  { email: email.trim().toLowerCase() },
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, _count: { select: { qrOrders: true } } },
  });
  return { customer: user ? { ...user, orderCount: user._count.qrOrders } : null };
};

const CHANNEL_LABEL: Record<string, string> = {
  WEBSITE: 'Website', INFLUENCER: 'Influencer', CAMPAIGN: 'Campaign', SUPPORT: 'Customer support', OFFLINE_SALE: 'Offline sale', OTHER: 'Other',
};

/**
 * Admin creates a sticker order on someone's behalf. It becomes a normal
 * order: the same vehicle registration, the same fulfilment queue, reprint
 * and replacement. Complimentary and offline-paid orders are confirmed
 * straight away; "customer pays online" orders wait in the customer's
 * account until they pay.
 */
export const adminCreateQrOrder = async (actorId: string, input: AdminCreateQrOrderInput) => {
  // 1) Customer: match by email, or create an account they can sign in to later (Google, same email).
  let user = await prisma.user.findUnique({ where: { email: input.customer.email } });
  if (user && user.status !== 'ACTIVE') throw BadRequest('This customer account is not active');
  if (!user) {
    const phoneTaken = input.customer.phone ? await prisma.user.findUnique({ where: { phone: input.customer.phone } }) : null;
    user = await prisma.user.create({
      data: {
        email:    input.customer.email,
        fullName: input.customer.fullName,
        phone:    phoneTaken ? null : input.customer.phone ?? null,
        role:     'CUSTOMER',
      },
    });
  }

  // 2) Vehicle + order, exactly like a website order.
  const { order } = await createQrOrder(user.id, {
    vehicle:       input.vehicle,
    shippingName:  input.shippingName,
    shippingPhone: input.shippingPhone,
    addressLine:   input.addressLine,
    city:          input.city,
    state:         input.state,
    pincode:       input.pincode,
    note:          input.note,
  });

  // 3) Payment + confirmation.
  const p = input.payment;
  const now = new Date();
  const channelLabel = CHANNEL_LABEL[input.channel];
  const pricePaise =
    p.mode === 'COMPLIMENTARY' ? 0 : p.mode === 'OFFLINE' ? Math.round(p.amount * 100) : await getStickerPricePaise();
  const paid = p.mode !== 'ONLINE';
  const paymentNote =
    p.mode === 'COMPLIMENTARY'
      ? `not paid${p.reason ? `: ${p.reason}` : ''}`
      : p.mode === 'OFFLINE'
        ? `paid ₹${p.amount} offline (${p.method.toLowerCase().replace('_', ' ')})`
        : 'customer pays online';
  const paidAt = p.mode === 'OFFLINE' && p.paidOn ? p.paidOn : now;

  await prisma.$transaction([
    prisma.qrOrder.update({
      where: { id: order.id },
      data: {
        source:            'ADMIN',
        channel:           input.channel,
        paymentMode:       p.mode,
        createdById:       actorId,
        stickerPricePaise: pricePaise,
        ...(paid
          ? {
              paymentStatus: 'PAID',
              paidAt,
              paymentRef:    p.mode === 'COMPLIMENTARY' ? 'COMPLIMENTARY' : `OFFLINE${p.reference ? `:${p.reference}` : ''}`,
              status:        'CONFIRMED',
              confirmedAt:   now,
            }
          : {}),
      },
    }),
    ...(p.mode === 'OFFLINE'
      ? [prisma.payment.create({
          data: {
            qrOrderId:         order.id,
            provider:          'offline',
            providerPaymentId: p.reference || null,
            amount:            p.amount,
            status:            'PAID',
            rawResponse:       JSON.stringify({ method: p.method, reference: p.reference ?? null, paidOn: paidAt, recordedBy: actorId }),
            createdAt:         paidAt,
          },
        })]
      : []),
    prisma.qrOrderStatusEvent.create({
      data: {
        qrOrderId: order.id,
        status:    paid ? 'CONFIRMED' : 'PENDING',
        note:      `Order created by admin (${channelLabel}, ${paymentNote})`,
        actorId,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId, action: 'QR_ORDER_ADMIN_CREATE', entity: 'QrOrder', entityId: order.id,
        metadata: JSON.stringify({ channel: input.channel, paymentMode: p.mode, pricePaise, customerId: user.id }),
      },
    }),
  ]);

  return { orderId: order.id, customerId: user.id, status: paid ? 'CONFIRMED' : 'PENDING' };
};

/** Status-event notes for a replacement sticker start with this — it's how replacements are counted. */
const REPLACEMENT_NOTE_PREFIX = 'Replacement sticker';

/**
 * How many times each order was delivered, returned, and re-sent as a
 * replacement — derived from the status timeline, so it covers history too.
 */
const qrOrderFulfilmentCounts = async (orderIds: string[]) => {
  const out = new Map<string, { delivered: number; returned: number; replacements: number }>();
  if (orderIds.length === 0) return out;
  const events = await prisma.qrOrderStatusEvent.findMany({
    where:  { qrOrderId: { in: orderIds }, status: { in: ['DELIVERED', 'RETURNED', 'CONFIRMED'] } },
    select: { qrOrderId: true, status: true, note: true },
  });
  for (const e of events) {
    const c = out.get(e.qrOrderId) ?? { delivered: 0, returned: 0, replacements: 0 };
    if (e.status === 'DELIVERED') c.delivered += 1;
    else if (e.status === 'RETURNED') c.returned += 1;
    else if (e.note?.startsWith(REPLACEMENT_NOTE_PREFIX)) c.replacements += 1;
    out.set(e.qrOrderId, c);
  }
  return out;
};

/** The QR token an order's car answers to — claimed sticker first, else the one recorded at dispatch. */
const qrOrderStickerToken = async (orderId: string) => {
  const order = await prisma.qrOrder.findUnique({
    where:   { id: orderId },
    include: {
      dispatchedSticker: { select: { token: true } },
      registration: {
        select: { plateNumber: true, qrStickers: { where: { status: 'CLAIMED' }, orderBy: { claimedAt: 'desc' }, take: 1, select: { token: true } } },
      },
    },
  });
  if (!order) throw NotFound('Order not found');
  const token = order.registration?.qrStickers[0]?.token ?? order.dispatchedSticker?.token ?? null;
  return { order, token, plate: order.registration ? decryptField(order.registration.plateNumber) : null };
};

/**
 * Print-ready PDF of the exact QR already linked to this order's car — same
 * branded design as batch printing — so a lost/damaged sticker can be
 * reprinted without the customer having to set anything up again.
 */
export const getQrOrderStickerPdf = async (id: string) => {
  const { token, plate } = await qrOrderStickerToken(id);
  if (!token) throw BadRequest('No QR sticker is linked to this order yet');
  const pdf = await generateStickerBatchPdf([{ token, url: stickerUrl(token) }]);
  const safe = (plate ?? token).replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');
  return { filename: `qr-sticker-${safe}.pdf`, pdf };
};

/**
 * Lost or damaged sticker after delivery: send the customer a reprint of the
 * SAME QR. Puts the order back to CONFIRMED (pickup -> dispatch -> delivery
 * runs again, as a new delivery attempt) and records why on the timeline,
 * which the customer sees too. The QR stays linked to the car, so calls keep
 * working and nothing needs re-configuring.
 */
/** Orders that can be handed over in person: paid, not yet delivered, not cancelled. */
const HANDOVER_FROM = ['CONFIRMED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'RETURNED'];
export const HANDOVER_NOTE_PREFIX = 'Handed over to the customer in person';

/**
 * Offline hand-over: the admin team gives the stickers to the customer
 * directly, so no courier is involved. Marks the order DELIVERED in one step
 * and records it on the timeline (visible to the customer too).
 */
export const handoverQrOrder = async (
  id: string,
  actorId: string,
  input: { handedOverOn?: Date; receivedBy?: string; note?: string },
) => {
  const order = await prisma.qrOrder.findUnique({ where: { id } });
  if (!order) throw NotFound('Order not found');
  if (order.paymentStatus !== 'PAID') throw BadRequest('Only a paid order can be handed over');
  if (!HANDOVER_FROM.includes(order.status)) {
    throw BadRequest(order.status === 'DELIVERED' ? 'This order is already delivered' : `Cannot hand over an order that is ${order.status.toLowerCase()}`);
  }

  const at = input.handedOverOn && input.handedOverOn.getTime() <= Date.now() ? input.handedOverOn : new Date();
  const details = [input.receivedBy ? `received by ${input.receivedBy}` : null, input.note || null].filter(Boolean).join('. ');
  const note = details ? `${HANDOVER_NOTE_PREFIX}, ${details}` : HANDOVER_NOTE_PREFIX;

  const [updated] = await prisma.$transaction([
    prisma.qrOrder.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: at } }),
    prisma.qrOrderStatusEvent.create({ data: { qrOrderId: id, status: 'DELIVERED', note, actorId, createdAt: at } }),
    prisma.auditLog.create({
      data: {
        actorId, action: 'QR_ORDER_HANDOVER', entity: 'QrOrder', entityId: id,
        metadata: JSON.stringify({ from: order.status, handedOverOn: at, receivedBy: input.receivedBy ?? null }),
      },
    }),
  ]);
  return updated;
};

export const sendQrOrderReplacement = async (
  id: string,
  actorId: string,
  input: { reason: string; mode?: 'REPRINT' | 'NEW_CODE'; token?: string },
) => {
  const reason = input.reason.trim();
  const mode = input.mode ?? 'REPRINT';
  const order = await prisma.qrOrder.findUnique({
    where:   { id },
    include: {
      dispatchedSticker: { select: { id: true, token: true, status: true } },
      registration: {
        select: { id: true, status: true, userId: true, qrStickers: { where: { status: 'CLAIMED' }, take: 1, select: { id: true, token: true } } },
      },
    },
  });
  if (!order) throw NotFound('Order not found');
  if (order.paymentStatus !== 'PAID') throw BadRequest('Only a paid order can get a replacement sticker');
  if (order.status !== 'DELIVERED') throw BadRequest('A replacement can only be sent for a delivered order');

  const current = order.registration?.qrStickers[0]
    ?? (order.dispatchedSticker && order.dispatchedSticker.status !== 'DISABLED' ? order.dispatchedSticker : null);

  const reopen = {
    status: 'CONFIRMED' as const,
    confirmedAt: new Date(), pickedUpAt: null, outForDeliveryAt: null, deliveredAt: null, returnedAt: null,
    deliveryAttempt: { increment: 1 },
  };

  // Damaged or faded: reprint the same QR, nothing changes for the car.
  if (mode === 'REPRINT') {
    if (!current) throw BadRequest('No QR sticker is linked to this order yet');
    const [updated] = await prisma.$transaction([
      prisma.qrOrder.update({ where: { id }, data: reopen }),
      prisma.qrOrderStatusEvent.create({ data: { qrOrderId: id, status: 'CONFIRMED', note: `${REPLACEMENT_NOTE_PREFIX}, reprint of the same QR: ${reason}`, actorId } }),
      prisma.auditLog.create({
        data: { actorId, action: 'QR_ORDER_REPLACEMENT', entity: 'QrOrder', entityId: id, metadata: JSON.stringify({ mode, token: current.token, reason }) },
      }),
    ]);
    return updated;
  }

  // Lost, stolen or misused: a new code, linked to the car right away (the
  // customer sets nothing up), and every old code of this car switched off in
  // the same transaction, so there is never a moment with two live QRs.
  const reg = order.registration;
  if (!reg || reg.status === 'DELETED') throw BadRequest('The vehicle for this order was removed, so a new code can not be linked to it');
  if (reg.userId !== order.userId) throw BadRequest('This vehicle now belongs to a different account. Replace the QR from that customer\'s order.');

  let picked: { id: string; token: string } | null = null;
  if (input.token?.trim()) {
    const code = parseStickerCode(input.token);
    const st = await prisma.qrSticker.findUnique({ where: { token: code }, include: { dispatchedFor: { select: { id: true } } } });
    if (!st) throw NotFound(`No sticker found with code ${code}`);
    if (st.status !== 'UNCLAIMED') throw Conflict(`Sticker ${code} is ${st.status === 'DISABLED' ? 'disabled' : 'already linked to a vehicle'}. Pick an unused sticker.`);
    if (st.dispatchedFor) throw Conflict(`Sticker ${code} is already recorded against another order. Pick an unused sticker.`);
    picked = { id: st.id, token: st.token };
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await lockVehicle(tx, reg.id);

    let fresh = picked;
    if (!fresh) {
      // No stock sticker given: mint a new code in the replacements batch, ready to print.
      const batch = (await tx.qrBatch.findFirst({ where: { label: REPLACEMENT_BATCH_LABEL }, orderBy: { createdAt: 'asc' } }))
        ?? (await tx.qrBatch.create({ data: { label: REPLACEMENT_BATCH_LABEL, quantity: 0, note: 'Codes issued by "Replace QR code"', createdById: actorId } }));
      fresh = await tx.qrSticker.create({ data: { batchId: batch.id, token: nanoid(8) }, select: { id: true, token: true } });
      await tx.qrBatch.update({ where: { id: batch.id }, data: { quantity: { increment: 1 } } });
    }

    // Switch off the car's live code(s) and this order's unused dispatched code.
    const old = await tx.qrSticker.findMany({
      where: {
        NOT: { id: fresh.id },
        OR: [
          { registrationId: reg.id, status: 'CLAIMED' },
          ...(order.dispatchedStickerId ? [{ id: order.dispatchedStickerId, status: 'UNCLAIMED' as const }] : []),
        ],
      },
      select: { id: true, token: true },
    });
    if (old.length) {
      await tx.qrSticker.updateMany({
        where: { id: { in: old.map((o) => o.id) } },
        data:  { status: 'DISABLED', disabledAt: now, disabledReason: `Replaced by ${fresh.token}: ${reason}`.slice(0, 190) },
      });
    }

    const claimed = await tx.qrSticker.updateMany({
      where: { id: fresh.id, status: 'UNCLAIMED' },
      data:  { status: 'CLAIMED', registrationId: reg.id, claimedByUserId: order.userId, claimedAt: now },
    });
    if (claimed.count !== 1) throw Conflict(`Sticker ${fresh.token} was just used elsewhere. Pick another sticker.`);

    const updated = await tx.qrOrder.update({
      where: { id },
      data:  { ...reopen, dispatchedStickerId: fresh.id, dispatchedAt: now },
    });
    await tx.qrOrderStatusEvent.create({
      data: { qrOrderId: id, status: 'CONFIRMED', actorId, note: `${REPLACEMENT_NOTE_PREFIX}, new QR code: ${reason}. The old QR is switched off.` },
    });
    await tx.auditLog.create({
      data: {
        actorId, action: 'QR_ORDER_REPLACEMENT', entity: 'QrOrder', entityId: id,
        metadata: JSON.stringify({ mode, reason, from: old.map((o) => o.token), to: fresh.token, minted: !picked }),
      },
    });
    return { ...updated, newToken: fresh.token, disabledTokens: old.map((o) => o.token) };
  });
  return result;

};

export const setQrOrderStatus = async (id: string, actorId: string, status: string, note?: string) => {
  const order = await prisma.qrOrder.findUnique({ where: { id } });
  if (!order) throw NotFound('Order not found');

  const allowed = QR_ORDER_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw BadRequest(`Cannot move an order from ${order.status} to ${status}`);
  }

  const isResend = order.status === 'RETURNED' && status === 'CONFIRMED';
  const now = new Date();

  const timestamps: Record<string, Date | null> =
    status === 'CONFIRMED'        ? (isResend ? { confirmedAt: now, pickedUpAt: null, outForDeliveryAt: null, deliveredAt: null, returnedAt: null } : { confirmedAt: now }) :
    status === 'PICKED_UP'        ? { pickedUpAt: now } :
    status === 'OUT_FOR_DELIVERY' ? { outForDeliveryAt: now } :
    status === 'DELIVERED'        ? { deliveredAt: now } :
    status === 'RETURNED'         ? { returnedAt: now } :
    {};

  const [updated] = await prisma.$transaction([
    prisma.qrOrder.update({
      where: { id },
      data: {
        status: status as any,
        ...timestamps,
        ...(isResend ? { deliveryAttempt: { increment: 1 } } : {}),
      },
    }),
    prisma.qrOrderStatusEvent.create({
      data: {
        qrOrderId: id,
        status:    status as any,
        note:      note ?? (isResend ? 'Sticker resent after return' : null),
        actorId,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId, action: `QR_ORDER_${status}`, entity: 'QrOrder', entityId: id,
        metadata: note ? JSON.stringify({ note }) : null,
      },
    }),
  ]);

  if (status === 'CANCELLED') await settleStickerAfterCancel(id, actorId, order.status);
  return updated;
};

/**
 * Refund is a financial action, independent of the fulfilment state machine
 * above — a paid order can be refunded whatever stage it's at (even
 * DELIVERED or RETURNED), so this bypasses QR_ORDER_TRANSITIONS entirely and
 * always lands the order on CANCELLED. Mirrors refundBooking's online-payment
 * path: the amount/note land on the underlying Payment row (same
 * refundAmount/refundedAt/refundNote fields, same REFUNDED status), so
 * refunded totals stay consistent with how booking refunds are tracked.
 */
export const refundQrOrder = async (id: string, actorId: string, amount: number, note?: string) => {
  const order = await prisma.qrOrder.findUnique({
    where: { id },
    include: { payments: { where: { status: 'PAID' }, orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!order) throw NotFound('Order not found');
  if (order.paymentStatus !== 'PAID') throw BadRequest('Only a paid order can be refunded');

  const maxRefund = (order.stickerPricePaise + order.monthlyPricePaise) / 100;
  if (amount <= 0 || amount > maxRefund) {
    throw BadRequest(`Refund amount must be between ₹1 and ₹${maxRefund}`);
  }

  const payment = order.payments[0];
  if (!payment) throw BadRequest('No payment record found for this order');
  if (!payment.providerPaymentId) throw BadRequest('Payment has no gateway reference, cannot refund');

  // Must actually refund at the gateway before the DB ever says REFUNDED.
  const gateway = getGateway();
  const refund = await gateway.refund({
    paymentId: payment.providerPaymentId,
    amountPaise: Math.round(amount * 100),
    notes: { qrOrderId: id, reason: note ?? '' },
  });

  const [, , updated] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'REFUNDED', refundAmount: amount, refundedAt: new Date(), refundNote: note ?? null,
        providerRefundId: refund.providerRefundId,
      },
    }),
    prisma.qrOrderStatusEvent.create({
      data: {
        qrOrderId: id, status: 'CANCELLED', actorId,
        note: `Refunded ₹${amount}${note ? `, ${note}` : ''}`,
      },
    }),
    prisma.qrOrder.update({
      where: { id },
      data: { status: 'CANCELLED', paymentStatus: 'REFUNDED' },
    }),
    prisma.auditLog.create({
      data: {
        actorId, action: 'QR_ORDER_REFUND', entity: 'QrOrder', entityId: id,
        metadata: JSON.stringify({ amount, note, providerRefundId: refund.providerRefundId, gatewayStatus: refund.status }),
      },
    }),
  ]);

  await settleStickerAfterCancel(id, actorId, order.status);
  return updated;
};

// ── QR stickers — batch generation & lifecycle ─────────────────────────────
// Each sticker carries a random high-entropy token in its printed URL
// (<customer site>/c/<token>). Tokens are minted here before printing; a
// sticker is UNCLAIMED until an owner scans + configures it.

const stickerUrl = (token: string) => `${env.FRONTEND_CUSTOMER_URL}/c/${token}`;

export const generateQrBatch = async (actorId: string, input: GenerateQrBatchInput) => {
  const tokens = new Set<string>();
  // 8 chars, nanoid's 64-symbol alphabet -> ~48 bits (~2.8x10^14 combinations).
  // Brute-forcing a live token is infeasible under the rate limit on
  // GET /c/t/:token (see scan.routes.ts) — short enough to read/type off a
  // sticker if the QR itself gets damaged, still far too large to guess.
  while (tokens.size < input.quantity) tokens.add(nanoid(8));

  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.qrBatch.create({
      data: { label: input.label, quantity: input.quantity, note: input.note ?? null, createdById: actorId },
    });
    await tx.qrSticker.createMany({
      data: [...tokens].map((token) => ({ batchId: b.id, token })),
    });
    return b;
  });

  await prisma.auditLog.create({
    data: {
      actorId, action: 'QR_BATCH_GENERATE', entity: 'QrBatch', entityId: batch.id,
      metadata: JSON.stringify({ label: batch.label, quantity: batch.quantity }),
    },
  });

  return batch;
};

export const listQrBatches = async () => {
  const [batches, counts] = await Promise.all([
    prisma.qrBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.qrSticker.groupBy({ by: ['batchId', 'status'], _count: { _all: true } }),
  ]);

  const byBatch = new Map<string, { unclaimed: number; claimed: number; disabled: number }>();
  for (const c of counts) {
    const row = byBatch.get(c.batchId) ?? { unclaimed: 0, claimed: 0, disabled: 0 };
    if (c.status === 'UNCLAIMED') row.unclaimed = c._count._all;
    if (c.status === 'CLAIMED')   row.claimed   = c._count._all;
    if (c.status === 'DISABLED')  row.disabled  = c._count._all;
    byBatch.set(c.batchId, row);
  }

  return {
    items: batches.map((b) => ({
      id:        b.id,
      label:     b.label,
      quantity:  b.quantity,
      note:      b.note,
      printedAt: b.printedAt,
      createdAt: b.createdAt,
      ...(byBatch.get(b.id) ?? { unclaimed: 0, claimed: 0, disabled: 0 }),
    })),
  };
};

export const updateQrBatch = async (id: string, actorId: string, input: UpdateQrBatchInput) => {
  const batch = await prisma.qrBatch.findUnique({ where: { id } });
  if (!batch) throw NotFound('Batch not found');

  const data: { label?: string; note?: string | null; printedAt?: Date | null } = {};
  if (input.label !== undefined) data.label = input.label;
  if (input.note !== undefined) data.note = input.note;
  if (input.markPrinted !== undefined) data.printedAt = input.markPrinted ? new Date() : null;

  const updated = await prisma.qrBatch.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: { actorId, action: 'QR_BATCH_UPDATE', entity: 'QrBatch', entityId: id },
  });
  return updated;
};

/** CSV export for the print vendor: token + full printed URL, one row per sticker. */
export const exportQrBatch = async (id: string) => {
  const batch = await prisma.qrBatch.findUnique({ where: { id } });
  if (!batch) throw NotFound('Batch not found');

  const stickers = await prisma.qrSticker.findMany({
    where:   { batchId: id },
    select:  { token: true },
    orderBy: { createdAt: 'asc' },
  });

  const rows = ['token,url', ...stickers.map((s) => `${s.token},${stickerUrl(s.token)}`)];
  const safeLabel = batch.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');
  return { filename: `qr-batch-${safeLabel || batch.id}.csv`, csv: rows.join('\n') + '\n' };
};

/**
 * Print-ready PDF for a batch — one page per sticker, each the full branded
 * design (not just the bare QR) sized to the physical sticker itself. See
 * lib/stickerPdf.ts.
 */
export const generateStickerPdf = async (id: string) => {
  const batch = await prisma.qrBatch.findUnique({ where: { id } });
  if (!batch) throw NotFound('Batch not found');

  const stickers = await prisma.qrSticker.findMany({
    where:   { batchId: id },
    select:  { token: true },
    orderBy: { createdAt: 'asc' },
  });

  const pdf = await generateStickerBatchPdf(stickers.map((s) => ({ token: s.token, url: stickerUrl(s.token) })));
  const safeLabel = batch.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');
  return { filename: `qr-stickers-${safeLabel || batch.id}.pdf`, pdf };
};

/** Every token + printable URL for a batch — used by the admin QR viewer/downloader. */
export const listQrBatchTokens = async (id: string) => {
  const batch = await prisma.qrBatch.findUnique({ where: { id } });
  if (!batch) throw NotFound('Batch not found');
  const stickers = await prisma.qrSticker.findMany({
    where:   { batchId: id },
    orderBy: { createdAt: 'asc' },
    select: {
      token: true, status: true, claimedAt: true,
      registration: {
        select: { plateNumber: true, vehicleType: true, contactPhone: true, user: { select: { fullName: true, email: true, phone: true } } },
      },
      // Sent in a package but not yet scanned and set up by the customer.
      dispatchedFor: {
        select: {
          id: true, dispatchedAt: true, shippingName: true, shippingPhone: true,
          user: { select: { email: true } },
          registration: { select: { plateNumber: true, vehicleType: true } },
        },
      },
    },
  });

  const items = stickers.map((st) => {
    const reg = st.registration;
    const order = st.dispatchedFor;
    // USED = linked to a vehicle; DISPATCHED = sent for an order, not set up yet; DISABLED; UNUSED.
    const usage =
      st.status === 'DISABLED' ? 'DISABLED'
        : st.status === 'CLAIMED' && reg ? 'USED'
        : order ? 'DISPATCHED'
        : 'UNUSED';
    return {
      token: st.token,
      url:   stickerUrl(st.token),
      usage,
      linkedAt: st.claimedAt,
      customer:
        usage === 'USED' && reg
          ? { name: reg.user.fullName, email: reg.user.email, mobile: decryptField(reg.contactPhone) }
          : order
            ? { name: order.shippingName, email: order.user.email, mobile: order.shippingPhone }
            : null,
      vehicle:
        usage === 'USED' && reg
          ? { plate: decryptField(reg.plateNumber), type: reg.vehicleType }
          : order?.registration
            ? { plate: decryptField(order.registration.plateNumber), type: order.registration.vehicleType }
            : null,
      dispatchedAt: order?.dispatchedAt ?? null,
    };
  });

  const counts = items.reduce<Record<string, number>>((acc, it) => ({ ...acc, [it.usage]: (acc[it.usage] ?? 0) + 1 }), {});
  return { batch: { id: batch.id, label: batch.label }, counts, items };
};

export const listQrStickers = async (opts: { q?: string; status?: string; batchId?: string }) => {
  const q = (opts.q ?? '').trim();
  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;
  if (opts.batchId) where.batchId = opts.batchId;

  // `q` matches a token fragment OR an exact plate (via its keyed hash).
  if (q) {
    const plate = normalizePlate(q);
    const or: Record<string, unknown>[] = [{ token: { contains: q } }];
    if (/^[A-Z0-9]{4,16}$/.test(plate)) {
      or.push({ registration: { plateHash: hmacHash(plate) } });
    }
    where.OR = or;
  }

  const rows = await prisma.qrSticker.findMany({
    where,
    include: {
      batch:        { select: { label: true } },
      registration: { select: { plateNumber: true, user: { select: { email: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return {
    items: rows.map((s) => ({
      id:         s.id,
      token:      s.token,
      url:        stickerUrl(s.token),
      status:     s.status,
      batchLabel: s.batch.label,
      plate:      s.registration ? decryptField(s.registration.plateNumber) : null,
      ownerEmail: s.registration?.user.email ?? null,
      claimedAt:  s.claimedAt,
      disabledReason: s.disabledReason,
      createdAt:  s.createdAt,
    })),
  };
};

/**
 * Safety action: unlink a sticker from its vehicle without touching the
 * physical object (e.g. it was set up on the wrong car). A disabled sticker
 * stays disabled. The order's dispatch record is kept, so only that order's
 * customer can set it up again.
 */
export const unbindQrSticker = async (id: string, actorId: string, reason?: string) => {
  const sticker = await prisma.qrSticker.findUnique({ where: { id }, include: { registration: { select: { plateNumber: true } } } });
  if (!sticker) throw NotFound('Sticker not found');
  if (!sticker.registrationId) throw BadRequest('This sticker is not linked to any vehicle');

  const updated = await prisma.qrSticker.update({
    where: { id },
    data:  {
      status:          sticker.status === 'DISABLED' ? 'DISABLED' : 'UNCLAIMED',
      registrationId:  null,
      claimedByUserId: null,
      claimedAt:       null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId, action: 'QR_STICKER_UNBIND', entity: 'QrSticker', entityId: id,
      metadata: JSON.stringify({
        token: sticker.token,
        previousRegistrationId: sticker.registrationId,
        plate: sticker.registration ? decryptField(sticker.registration.plateNumber) : null,
        reason: reason ?? null,
      }),
    },
  });
  return updated;
};

export const setQrStickerDisabled = async (
  id: string,
  actorId: string,
  disabled: boolean,
  reason?: string,
) => {
  const sticker = await prisma.qrSticker.findUnique({ where: { id }, include: { registration: { select: { status: true } } } });
  if (!sticker) throw NotFound('Sticker not found');
  if (disabled === (sticker.status === 'DISABLED')) return sticker; // already in that state

  // Re-enabling goes back to the car only if the car still exists and has no
  // other live QR (e.g. this code was replaced); otherwise back to stock.
  const backToCar = !disabled && !!sticker.registrationId && sticker.registration?.status !== 'DELETED';
  const updated = await prisma.$transaction(async (tx) => {
    if (backToCar) {
      await lockVehicle(tx, sticker.registrationId!);
      const other = await activeStickerOf(tx, sticker.registrationId!, sticker.id);
      if (other) throw Conflict(`This vehicle already has a live QR (${other.token}). Disable that one first, or link this code to another order.`);
    }
    return tx.qrSticker.update({
      where: { id },
      data:  disabled
        ? { status: 'DISABLED', disabledAt: new Date(), disabledReason: reason ?? null }
        : backToCar
          ? { status: 'CLAIMED', disabledAt: null, disabledReason: null }
          : { status: 'UNCLAIMED', disabledAt: null, disabledReason: null, registrationId: null, claimedByUserId: null, claimedAt: null },
    });
  });
  await prisma.auditLog.create({
    data: { actorId, action: disabled ? 'QR_STICKER_DISABLE' : 'QR_STICKER_ENABLE', entity: 'QrSticker', entityId: id },
  });
  return updated;
};

// ── Audit log — every admin action across the app writes a row here via
// prisma.auditLog.create(); this is the one place to read them back. ───────
export const listAuditLogs = async (params: { q?: string; entity?: string; action?: string }) => {
  const { q, entity, action } = params;
  const search = (q ?? '').trim().toLowerCase();

  const rows = await prisma.auditLog.findMany({
    where: {
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
    },
    include: { actor: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const items = rows.map((r) => ({
    id:        r.id,
    action:    r.action,
    entity:    r.entity,
    entityId:  r.entityId,
    metadata:  r.metadata,
    createdAt: r.createdAt,
    actor:     r.actor ? { fullName: r.actor.fullName, email: r.actor.email } : null,
  }));

  if (!search) return { items };
  return {
    items: items.filter((r) =>
      r.action.toLowerCase().includes(search) ||
      r.entity.toLowerCase().includes(search) ||
      (r.entityId ?? '').toLowerCase().includes(search) ||
      (r.actor?.fullName ?? '').toLowerCase().includes(search) ||
      (r.actor?.email ?? '').toLowerCase().includes(search),
    ),
  };
};

/** Distinct entity types seen in the log, for the filter dropdown. */
export const listAuditLogEntities = async () => {
  const rows = await prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } });
  return { items: rows.map((r) => r.entity) };
};
