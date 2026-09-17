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
import { normalizePlate } from '@ps/types';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../config/logger.js';
import { decryptField, hmacHash } from '../../lib/crypto.js';
import { issuePermit, verifyPermit } from '../../lib/scanPermit.js';
import { BadRequest, Conflict, HttpError, NotFound } from '../../lib/http.js';
import * as vehiclesService from '../vehicles/vehicles.service.js';
import type { ConfigureStickerInput } from './scan.schema.js';

const logAttempt = (outcome: 'FOUND' | 'NOT_FOUND' | 'BOT_BLOCKED', plateHash: string | null, ip: string) =>
  prisma.lookupAttempt
    .create({ data: { outcome, plateHash, ipHash: hmacHash(ip) } })
    .catch(() => undefined); // logging is best-effort — never fail the request over it

/** Everything except the last 4 chars, e.g. "AP16CX7667" → "AP16CX". */
const plateMaskOf = (normalizedPlate: string) => normalizedPlate.slice(0, -4);
const plateLast4Of = (normalizedPlate: string) => normalizedPlate.slice(-4);

// The one-time sticker fee is lifetime by default (validUntil null). Admin
// can set a per-vehicle end date under individual terms — past it, the
// sticker/plate stops resolving, same as a paused registration.
export const isExpired = (validUntil: Date | null) => validUntil !== null && validUntil.getTime() < Date.now();
export const isUsable = (registration: { status: string; validUntil: Date | null }) =>
  registration.status === 'ACTIVE' && !isExpired(registration.validUntil);

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
  | { state: 'claimed'; plateMask: string; hasEmergency: boolean };

export const getStickerState = async (token: string): Promise<StickerState> => {
  const sticker = await prisma.qrSticker.findUnique({
    where:   { token },
    include: { registration: true },
  });
  if (!sticker) throw NotFound('This QR code is not recognised');

  if (sticker.status === 'DISABLED') return { state: 'disabled' };
  if (sticker.status !== 'CLAIMED' || !sticker.registration || sticker.registration.status !== 'ACTIVE') {
    return { state: 'unclaimed' };
  }
  if (isExpired(sticker.registration.validUntil)) return { state: 'expired' };

  return {
    state:       'claimed',
    plateMask:   plateMaskOf(normalizePlate(decryptField(sticker.registration.plateNumber))),
    hasEmergency: sticker.registration.emergencyPublic,
  };
};

/** First-scan setup by the owner (must be signed in). Binds this sticker to a vehicle. */
export const configureSticker = async (token: string, userId: string, input: ConfigureStickerInput) => {
  const sticker = await prisma.qrSticker.findUnique({ where: { token } });
  if (!sticker) throw NotFound('This QR code is not recognised');
  if (sticker.status === 'DISABLED') throw BadRequest('This sticker has been disabled — please contact support');
  if (sticker.status === 'CLAIMED') throw Conflict('This sticker is already set up');

  // Register the vehicle, reusing this user's own existing registration for
  // the same plate rather than failing (they may have added it elsewhere).
  // Either way, the full form (silent hours, ICE) the owner just filled in
  // here — possibly pre-filled from that existing registration and then
  // edited — is what ends up saved.
  let registration;
  const { plateNumber: _plateNumber, ...profileFields } = input;
  try {
    registration = await vehiclesService.registerVehicle(userId, input);
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      const existing = await prisma.vehicleRegistration.findUnique({
        where: { plateHash: hmacHash(input.plateNumber) }, // already normalized by the zod transform
      });
      if (existing && existing.userId === userId && existing.status !== 'DELETED') {
        registration = await vehiclesService.updateVehicle(userId, existing.id, profileFields);
      } else {
        throw e; // the plate belongs to another account
      }
    } else {
      throw e;
    }
  }

  await prisma.qrSticker.update({
    where: { id: sticker.id },
    data:  {
      status:          'CLAIMED',
      registrationId:  registration.id,
      claimedByUserId: userId,
      claimedAt:       new Date(),
    },
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
