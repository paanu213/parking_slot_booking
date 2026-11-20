/**
 * Public scan flow (QR Calling).
 *
 * Two entry points:
 *  - `/c` + typed full plate  → lookupPlate  (fallback for a damaged sticker)
 *  - `/c/:token` unique sticker → getStickerState → configure (owner, first
 *    scan) OR verify last-4 (any passer-by, later scans)
 *
 * A successful match yields only a short-lived signed `permit` — never a
 * phone number or owner identity. The ICE card additionally requires the
 * scanner to be signed in (Google), until SMS-OTP is available.
 */
import type { EmergencyCard, LookupResult } from '@ps/types';
import { isQrExpired } from '../../lib/qrValidity.js';
import { normalizePlate } from '@ps/types';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../config/logger.js';
import { decryptField, hmacHash } from '../../lib/crypto.js';
import { issuePermit, verifyPermit } from '../../lib/scanPermit.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/http.js';
import { activeStickerOf, lockVehicle } from '../../lib/qrStickerRules.js';
import * as vehiclesService from '../vehicles/vehicles.service.js';
import type { ConfigureStickerInput } from './scan.schema.js';

const logAttempt = (outcome: 'FOUND' | 'NOT_FOUND' | 'BOT_BLOCKED', plateHash: string | null, ip: string) =>
  prisma.lookupAttempt
    .create({ data: { outcome, plateHash, ipHash: hmacHash(ip) } })
    .catch(() => undefined); // logging is best-effort — never fail the request over it

/** Everything except the last 4 chars, e.g. "AP16CX7667" → "AP16CX". */
const plateMaskOf = (normalizedPlate: string) => normalizedPlate.slice(0, -4);
const plateLast4Of = (normalizedPlate: string) => normalizedPlate.slice(-4);

// A sticker is valid for 10 years from registration, or until the custom end
// date admin set (see lib/qrValidity.ts). Past it, the sticker/plate stops
// resolving, same as a paused registration.
export const isUsable = (registration: { status: string; validUntil: Date | null; createdAt: Date }) =>
  registration.status === 'ACTIVE' && !isQrExpired(registration);

// ── /c  (typed full plate — fallback) ─────────────────────────────────────────

export const lookupPlate = async (plate: string, ip: string, botToken?: string): Promise<LookupResult> => {
  // Honeypot: real users never populate this hidden field. Log it as bot
  // traffic but respond exactly like a normal miss — no tell for the bot.
  if (botToken) {
    await logAttempt('BOT_BLOCKED', null, ip);
    return { found: false };
  }

  const plateHash = hmacHash(plate); // `plate` already normalized by the LookupInput zod transform
  const registration = await prisma.vehicleRegistration.findUnique({ where: { plateHash } });

  if (!registration || !isUsable(registration)) {
    await logAttempt('NOT_FOUND', plateHash, ip);
    return { found: false };
  }

  await logAttempt('FOUND', plateHash, ip);
  return {
    found:        true,
    confirm:      plate,
    hasEmergency: registration.emergencyPublic,
    permit:       issuePermit(registration.id),
  };
};

// ── /c/:token  (unique sticker) ───────────────────────────────────────────────

type StickerState =
  | { state: 'unclaimed' }
  | { state: 'disabled' }
  | { state: 'expired' }
  | { state: 'inactive' }
  | { state: 'claimed'; plateMask: string; hasEmergency: boolean };

export const getStickerState = async (token: string): Promise<StickerState> => {
  const sticker = await prisma.qrSticker.findUnique({
    where:   { token },
    include: { registration: true },
  });
  if (!sticker) throw NotFound('This QR code is not recognised');

  if (sticker.status === 'DISABLED') return { state: 'disabled' };
  if (sticker.status !== 'CLAIMED' || !sticker.registration) return { state: 'unclaimed' };
  // Set up, but the owner paused (or removed) the vehicle: not a setup screen, which would only fail.
  if (sticker.registration.status !== 'ACTIVE') return { state: 'inactive' };
  if (isQrExpired(sticker.registration)) return { state: 'expired' };

  return {
    state:       'claimed',
    plateMask:   plateMaskOf(normalizePlate(decryptField(sticker.registration.plateNumber))),
    hasEmergency: sticker.registration.emergencyPublic,
  };
};

/**
 * First-scan setup by the owner (must be signed in). Binds this sticker to a vehicle.
 *
 * Guards (see lib/qrStickerRules.ts):
 *  - a sticker sent for an order can only be set up by that order's account,
 *    for that order's vehicle (a mixed-up or intercepted package can't be
 *    hijacked onto someone else's car);
 *  - a sticker not recorded at dispatch must match a paid order of this
 *    account for this vehicle, and gets recorded against it automatically;
 *  - a vehicle keeps one active QR, a second code needs an admin replacement;
 *  - the claim is atomic, so two people scanning the same new sticker at once
 *    can't both win.
 * Every check that can fail runs before the vehicle is saved, so a refused
 * setup leaves nothing half-done.
 */
export const configureSticker = async (token: string, userId: string, input: ConfigureStickerInput) => {
  const sticker = await prisma.qrSticker.findUnique({
    where:   { token },
    include: {
      dispatchedFor: {
        select: { id: true, userId: true, status: true, paymentStatus: true, registration: { select: { plateHash: true } } },
      },
    },
  });
  if (!sticker) throw NotFound('This QR code is not recognised');
  if (sticker.status === 'DISABLED') throw BadRequest('This sticker has been disabled, please contact support');
  // CLAIMED without a vehicle only happens to legacy rows whose car record was removed; treat as free.
  const isFree = sticker.status === 'UNCLAIMED' || (sticker.status === 'CLAIMED' && !sticker.registrationId);
  if (!isFree) throw Conflict('This sticker is already set up');

  const plateHash = hmacHash(input.plateNumber); // already normalized by the zod transform
  const existingReg = await prisma.vehicleRegistration.findUnique({
    where:  { plateHash },
    select: { id: true, userId: true, status: true },
  });
  if (existingReg && existingReg.status !== 'DELETED' && existingReg.userId !== userId) {
    throw Conflict('This car is already registered by another owner. Contact support if this is a mistake.');
  }
  const ownReg = existingReg && existingReg.status !== 'DELETED' ? existingReg : null;

  // Which order does this physical sticker belong to?
  let orderId: string;
  let recordDispatch = false;
  const sent = sticker.dispatchedFor;
  if (sent) {
    if (sent.userId !== userId) {
      throw Forbidden('This sticker was sent to a different AutoSahay account. Sign in with the account that placed the order, or contact support.');
    }
    if (sent.status === 'CANCELLED' || sent.paymentStatus !== 'PAID') {
      throw BadRequest('The order for this sticker was cancelled or refunded, so it can not be set up. Please contact support.');
    }
    if (sent.registration && sent.registration.plateHash !== plateHash) {
      throw BadRequest('This sticker was ordered for a different vehicle number. Enter the vehicle number from your order, or contact support to change it.');
    }
    orderId = sent.id;
  } else {
    const order = ownReg
      ? await prisma.qrOrder.findFirst({
          where:   { userId, registrationId: ownReg.id, paymentStatus: 'PAID', status: { not: 'CANCELLED' }, dispatchedStickerId: null },
          orderBy: { createdAt: 'desc' },
          select:  { id: true },
        })
      : null;
    if (!order) {
      throw BadRequest('We could not match this sticker to an order for this vehicle on your account. Check the vehicle number, or contact support.');
    }
    orderId = order.id;
    recordDispatch = true;
  }

  const ALREADY_HAS_QR = 'This vehicle already has an active QR sticker. If it was lost or damaged, contact support for a replacement.';
  if (ownReg && (await activeStickerOf(prisma, ownReg.id, sticker.id))) throw Conflict(ALREADY_HAS_QR);

  // Save the vehicle: the full form (silent hours, ICE) the owner just filled
  // in here is what ends up saved, on their existing registration if any.
  const { plateNumber: _plateNumber, ...profileFields } = input;
  const registration = ownReg
    ? await vehiclesService.updateVehicle(userId, ownReg.id, profileFields)
    : await vehiclesService.registerVehicle(userId, input);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await lockVehicle(tx, registration.id);
    if (await activeStickerOf(tx, registration.id, sticker.id)) throw Conflict(ALREADY_HAS_QR);

    const claimed = await tx.qrSticker.updateMany({
      where: { id: sticker.id, OR: [{ status: 'UNCLAIMED' }, { status: 'CLAIMED', registrationId: null }] },
      data:  { status: 'CLAIMED', registrationId: registration.id, claimedByUserId: userId, claimedAt: now },
    });
    if (claimed.count !== 1) throw Conflict('This sticker was just set up by someone else. Please contact support.');

    if (recordDispatch) {
      const linked = await tx.qrOrder.updateMany({
        where: { id: orderId, dispatchedStickerId: null },
        data:  { dispatchedStickerId: sticker.id, dispatchedAt: now },
      });
      if (linked.count === 1) {
        const o = await tx.qrOrder.findUnique({ where: { id: orderId }, select: { status: true } });
        await tx.qrOrderStatusEvent.create({
          data: { qrOrderId: orderId, status: o!.status, actorId: userId, note: `Sticker ${sticker.token} linked when the customer set it up` },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        actorId: userId, action: 'QR_STICKER_SETUP', entity: 'QrSticker', entityId: sticker.id,
        metadata: JSON.stringify({ token: sticker.token, registrationId: registration.id, orderId, recordedOnSetup: recordDispatch }),
      },
    });
  });

  return { ok: true, plateMask: plateMaskOf(normalizePlate(registration.plateNumber)) };
};

/** Passer-by enters the last 4 of the plate — proves they're at the car. */
export const verifyStickerPlate = async (token: string, last4: string, ip: string): Promise<LookupResult> => {
  const sticker = await prisma.qrSticker.findUnique({
    where:   { token },
    include: { registration: true },
  });
  const registration = sticker?.registration;

  if (!sticker || sticker.status !== 'CLAIMED' || !registration || !isUsable(registration)) {
    await logAttempt('NOT_FOUND', null, ip);
    return { found: false };
  }

  const fullPlate = normalizePlate(decryptField(registration.plateNumber));
  if (plateLast4Of(fullPlate) !== last4) {
    await logAttempt('NOT_FOUND', hmacHash(fullPlate), ip);
    return { found: false };
  }

  await logAttempt('FOUND', hmacHash(fullPlate), ip);
  return {
    found:        true,
    confirm:      fullPlate,
    hasEmergency: registration.emergencyPublic,
    permit:       issuePermit(registration.id),
  };
};

// ── ICE card (permit-scoped; route also requires a signed-in scanner —
// requireAuth — so the authenticated user id is the audit trail) ────────────

export const getEmergencyCard = async (permitToken: string, userId: string, ip: string): Promise<EmergencyCard> => {
  const registrationId = verifyPermit(permitToken);
  const registration = await prisma.vehicleRegistration.findUnique({
    where:   { id: registrationId },
    include: { emergencyContacts: true },
  });
  if (!registration || !isUsable(registration) || !registration.emergencyPublic) {
    throw NotFound('Emergency card not available');
  }

  // Best-effort audit trail — who viewed this car's emergency info and when.
  logger.info(
    { event: 'emergency_card_revealed', registrationId, userId, ipHash: hmacHash(ip) },
    'Emergency card revealed',
  );

  return {
    ownerName:    registration.ownerName ?? undefined,
    bloodGroup:   registration.bloodGroup ?? undefined,
    medicalNotes: registration.medicalNotes ? decryptField(registration.medicalNotes) : undefined,
    contacts: [...registration.emergencyContacts]
      .filter((c) => c.showPublic)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ name: c.name, relation: c.relation ?? undefined, phone: decryptField(c.phone) })),
  };
};
