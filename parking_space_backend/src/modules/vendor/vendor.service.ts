/**
 * Vendor service — business logic for the vendor portal: profile, locations,
 * slots, images, amenities, commission summary and direct (walk-in) bookings.
 * All persistence goes through Prisma; no HTTP concerns live here.
 */
import { prisma } from '../../lib/prisma.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/http.js';
import { calculateBookingAmount } from '../../lib/pricing.js';
import { getCommissionRate, commissionFor } from '../../lib/commission.js';
import { resolveDateRange } from '../../lib/dateRange.js';
import { deleteImageByUrl, storeImageBuffer, deleteDocumentByUrl } from '../../lib/images.js';
import { parsePendingEdits, mergePendingEdits, editChangesAnything, PROFILE_EDIT_FIELDS } from '../../lib/pendingEdits.js';
import {
  USER_FIELDS,
  type UserField,
  type AadhaarUploadInput,
  type LocationInput,
  type SlotInput,
  type SlotUpdateInput,
  type DirectBookingInput,
  type EditGuestInput,
} from './vendor.schema.js';

const VENDOR_USER_SELECT = { fullName: true, email: true, phone: true, avatarUrl: true } as const;

// ── Profile ──────────────────────────────────────────────────────────────────
export const getProfile = async (userId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { userId },
    include: { user: { select: VENDOR_USER_SELECT } },
  });
  if (!vendor) throw NotFound('Vendor profile not found');
  return vendor;
};

export const updateProfile = async (userId: string, body: Record<string, unknown>) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({
    where: { userId },
    include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
  });

  if (vendor.status === 'APPROVED') {
    // Live account — queue the edit for admin review WITHOUT touching live fields.
    // Accumulate a LIST of requests so a vendor can submit several modifications
    // before an admin acts; the admin sees every one and approves/rejects the set.
    const requests = parsePendingEdits(vendor.pendingProfileData as string | null);
    const snapshot: Record<string, unknown> = {
      fullName: vendor.user.fullName, phone: vendor.user.phone, email: vendor.user.email,
      businessName: vendor.businessName, contactPhone: vendor.contactPhone, address: vendor.address,
      gstNumber: vendor.gstNumber, panNumber: vendor.panNumber, payoutUpiId: vendor.payoutUpiId,
      aadharNumber: vendor.aadharNumber, aadharDocUrl: vendor.aadharDocUrl,
    };
    const baseline = { ...snapshot, ...mergePendingEdits(requests) };
    if (editChangesAnything(baseline, body, PROFILE_EDIT_FIELDS)) {
      requests.push({ data: body, submittedAt: new Date().toISOString() });
      await prisma.vendor.update({
        where: { userId },
        data: { pendingProfileData: JSON.stringify(requests) },
      });
    }
  } else {
    // Separate user fields from vendor fields
    const userUpdate: Partial<Record<UserField, string>> = {};
    const vendorUpdate: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
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
      await prisma.vendor.update({ where: { userId }, data: vendorUpdate });
    }
  }

  return prisma.vendor.findUniqueOrThrow({
    where: { userId },
    include: { user: { select: VENDOR_USER_SELECT } },
  });
};

/**
 * Vendor withdraws their own pending profile edit request(s) before an admin
 * acts on them. Clears the queue and cleans up any newly-uploaded Aadhaar docs
 * that were never applied (so orphan files don't linger in storage).
 */
export const withdrawProfileEdits = async (userId: string) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { userId } });
  const requests = parsePendingEdits(vendor.pendingProfileData as string | null);
  if (requests.length === 0) throw BadRequest('No pending profile changes to withdraw');

  // Delete any uploaded-but-never-applied Aadhaar docs from storage.
  const docs = new Set<string>();
  for (const r of requests) {
    const url = String((r.data as Record<string, unknown>)?.aadharDocUrl ?? '').trim();
    if (url && url !== vendor.aadharDocUrl) docs.add(url);
  }
  for (const url of docs) await deleteDocumentByUrl(url).catch(() => {});

  return prisma.vendor.update({
    where: { userId },
    data: { pendingProfileData: null },
    include: { user: { select: VENDOR_USER_SELECT } },
  });
};

export const uploadAadhaar = async (userId: string, body: AadhaarUploadInput) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { userId } });
  // Remove the previous doc from storage if it's being replaced.
  if (vendor.aadharDocUrl && vendor.aadharDocUrl !== body.aadharDocUrl) {
    await deleteDocumentByUrl(vendor.aadharDocUrl).catch(() => {});
  }
  return prisma.vendor.update({
    where: { userId },
    data: {
      aadharNumber:       body.aadharNumber ?? vendor.aadharNumber,
      aadharDocUrl:       body.aadharDocUrl,
      aadharVerifiedAt:   null,
      aadharVerifiedById: null,
    },
    include: { user: { select: VENDOR_USER_SELECT } },
  });
};

// ── Ownership guards ───────────────────────────────────────────────────────
export const ensureOwnLocation = async (vendorUserId: string, locationId: string) => {
  const loc = await prisma.parkingLocation.findFirst({
    where: { id: locationId, vendor: { userId: vendorUserId } },
  });
  if (!loc) throw Forbidden('Not your location');
  return loc;
};

export const ensureOwnSlot = async (vendorUserId: string, slotId: string) => {
  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: { location: { include: { vendor: true } } },
  });
  if (!slot || slot.location.vendor.userId !== vendorUserId) throw Forbidden();
  return slot;
};

// ── Locations ────────────────────────────────────────────────────────────────
export const createLocation = async (userId: string, body: LocationInput) => {
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { userId } });
  return prisma.parkingLocation.create({
    data: { ...body, vendorId: vendor.id, isActive: false, approvalStatus: 'PENDING_REVIEW' },
  });
};

export const listLocations = async (userId: string) => {
  const items = await prisma.parkingLocation.findMany({
    where: { vendor: { userId } },
    include: {
      slots: true,
      images: true,
      amenities: { include: { amenity: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return { items };
};

export const deleteLocation = async (userId: string, locationId: string) => {
  const loc = await ensureOwnLocation(userId, locationId);
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
};

export const updateLocation = async (userId: string, locationId: string, body: LocationInput) => {
  const loc = await ensureOwnLocation(userId, locationId);
  let data: Record<string, unknown>;
  if (loc.approvalStatus === 'APPROVED') {
    // Space is live — queue the edit for admin review WITHOUT overwriting live
    // fields. Append it to the list of pending requests so multiple un-approved
    // edits accumulate (the admin sees every submission, not just the latest).
    const requests = parsePendingEdits(loc.pendingData as string | null);
    const baseline = requests.length
      ? requests[requests.length - 1].data
      : (loc as unknown as Record<string, unknown>);
    if (!editChangesAnything(baseline, body as Record<string, unknown>)) {
      // Nothing actually changed vs the latest submitted state — no-op.
      return prisma.parkingLocation.findUniqueOrThrow({ where: { id: locationId } });
    }
    requests.push({ data: body as Record<string, unknown>, submittedAt: new Date().toISOString() });
    data = { pendingData: JSON.stringify(requests) };
  } else {
    // PENDING_REVIEW or REJECTED — update directly and resubmit for review
    data = { ...body, approvalStatus: 'PENDING_REVIEW', approvalNote: null };
  }
  return prisma.parkingLocation.update({ where: { id: locationId }, data });
};

export const toggleLocationStatus = async (userId: string, locationId: string, isActive: boolean) => {
  const loc = await ensureOwnLocation(userId, locationId);
  if (loc.approvalStatus !== 'APPROVED') throw BadRequest('Only approved spaces can be toggled');
  return prisma.parkingLocation.update({
    where: { id: locationId },
    data: { isActive },
  });
};

// ── Slots ─────────────────────────────────────────────────────────────────
export const createSlot = async (userId: string, locationId: string, body: SlotInput) => {
  await ensureOwnLocation(userId, locationId);
  return prisma.slot.create({ data: { ...body, locationId } });
};

export const updateSlot = async (userId: string, slotId: string, body: SlotUpdateInput) => {
  const slot = await ensureOwnSlot(userId, slotId);
  return prisma.slot.update({ where: { id: slot.id }, data: body });
};

export const updateSlotStatus = async (userId: string, slotId: string, status: unknown) => {
  const slot = await ensureOwnSlot(userId, slotId);
  return prisma.slot.update({
    where: { id: slot.id },
    data: { status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
  });
};

export const getSlotBookings = async (userId: string, slotId: string) => {
  const owned = await ensureOwnSlot(userId, slotId);

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

// ── Images ────────────────────────────────────────────────────────────────
export const addLocationImages = async (
  userId: string,
  locationId: string,
  files: Express.Multer.File[],
) => {
  await ensureOwnLocation(userId, locationId);
  if (!files.length) throw BadRequest('No files uploaded');

  const existing = await prisma.locationImage.count({ where: { locationId } });
  const created = await Promise.all(
    files.map(async (f, i) => {
      const img = await storeImageBuffer(f.buffer);
      return prisma.locationImage.create({
        data: {
          locationId,
          url: img.url,
          width: img.width,
          height: img.height,
          sortOrder: existing + i,
        },
      });
    }),
  );
  return { items: created };
};

export const deleteLocationImage = async (userId: string, locationId: string, imageId: string) => {
  await ensureOwnLocation(userId, locationId);
  const image = await prisma.locationImage.findFirst({
    where: { id: imageId, locationId },
  });
  if (!image) throw NotFound('Image not found');
  await prisma.locationImage.delete({ where: { id: image.id } });
  await deleteImageByUrl(image.url);
};

// ── Amenities ───────────────────────────────────────────────────────────────
export const listAmenities = async () => {
  const items = await prisma.amenity.findMany({ orderBy: { name: 'asc' } });
  return { items };
};

export const setLocationAmenities = async (
  userId: string,
  locationId: string,
  amenityIds: string[],
) => {
  await ensureOwnLocation(userId, locationId);
  // Replace all: delete existing then insert new
  await prisma.parkingLocationAmenity.deleteMany({ where: { locationId } });
  if (amenityIds.length > 0) {
    await prisma.parkingLocationAmenity.createMany({
      data: amenityIds.map((amenityId) => ({ locationId, amenityId })),
      skipDuplicates: true,
    });
  }
  return prisma.parkingLocation.findUnique({
    where: { id: locationId },
    include: { amenities: { include: { amenity: true } } },
  });
};

// ── Bookings & commission ─────────────────────────────────────────────────
export const listBookings = async (userId: string) => {
  const items = await prisma.booking.findMany({
    where: { slot: { location: { vendor: { userId } } } },
    include: { slot: { include: { location: true } }, user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return { items };
};

export const commissionSummary = async (
  userId: string,
  period?: string,
  from?: string,
  to?: string,
) => {
  const range = resolveDateRange(period, from, to);
  const due = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED', 'COMPLETED'] },
      slot:   { location: { vendor: { userId } } },
      ...(range ? { createdAt: range } : {}),
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

  return {
    rate: await getCommissionRate(),
    totalCommission,
    paidCommission,
    pendingCommission: totalCommission - paidCommission,
    bookings: due.length,
    spaces: [...bySpace.values()].map((s) => ({ ...s, pending: s.total - s.paid })),
  };
};

export const createDirectBooking = async (userId: string, input: DirectBookingInput) => {
  const {
    slotId, guestName, guestEmail, guestPhone, guestVehicleNumber, guestVehicleModel,
    bookingType, startAt, endAt, totalAmount,
  } = input;
  const email = guestEmail.trim().toLowerCase();
  const commissionRate = await getCommissionRate();

  return prisma.$transaction(async (tx) => {
    // Lock slot row and verify ownership
    await tx.$queryRawUnsafe('SELECT id FROM Slot WHERE id = ? FOR UPDATE', slotId);

    const slot = await tx.slot.findUnique({
      where: { id: slotId },
      include: { location: { include: { vendor: true } } },
    });
    if (!slot || slot.status !== 'ACTIVE') throw BadRequest('Slot is not available');
    if (slot.location.vendor.userId !== userId) throw Forbidden('Not your slot');

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

    // Store the guest email on the booking. If a customer account already uses
    // this email, link it now; otherwise leave it unlinked — it gets claimed when
    // a customer signs up / logs in with this email (see claimDirectBookings).
    // We never auto-create an account here, so the customer just registers normally.
    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });

    const { nanoid } = await import('nanoid');
    return tx.booking.create({
      data: {
        reference: `DB-${nanoid(10).toUpperCase()}`,
        slotId,
        userId: existing?.id ?? null,
        isDirectBooking: true,
        guestName,
        guestEmail: email,
        guestPhone: guestPhone ?? null,
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
};

export const editGuestBooking = async (
  userId: string,
  bookingId: string,
  body: EditGuestInput,
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: { include: { location: { include: { vendor: true } } } } },
  });
  if (!booking) throw NotFound('Booking not found');
  if (!booking.isDirectBooking) throw BadRequest('Only direct bookings can be edited');
  if (booking.slot.location.vendor.userId !== userId) {
    throw Forbidden('You do not have access to this booking');
  }

  const { startAt, endAt, bookingType, guestEmail, ...guestFields } = body;

  // If the email is being corrected, normalize it and re-link the booking to an
  // account with that email (or leave it unlinked to be claimed on signup).
  let emailUpdate: { guestEmail: string; userId: string | null } | null = null;
  if (guestEmail !== undefined) {
    const email = guestEmail.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    emailUpdate = { guestEmail: email, userId: existing?.id ?? null };
  }

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
      throw BadRequest(e?.message ?? 'Could not recalculate booking amount');
    }
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      ...guestFields,
      ...(emailUpdate ?? {}),
      ...(bookingType ? { bookingType } : {}),
      ...(recalc ? {
        startAt:          recalc.startAt,
        endAt:            recalc.endAt,
        totalAmount:      recalc.amount,
        commissionAmount: Math.round(recalc.amount * Number(booking.commissionRate)) / 100,
      } : {}),
    },
  });
};

export const cancelBooking = async (userId: string, bookingId: string, reason?: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: { include: { location: { include: { vendor: true } } } } },
  });
  if (!booking) throw BadRequest('Booking not found');

  // Ownership check — booking must belong to this vendor's slot
  if (booking.slot.location.vendor.userId !== userId) {
    throw Forbidden('You do not have access to this booking');
  }

  if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.status)) {
    throw BadRequest('Only confirmed or pending bookings can be cancelled');
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      cancelReason: reason ?? null,
    },
  });
};
