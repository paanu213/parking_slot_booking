/**
 * Vehicle registration service — "My Vehicles" (QR Calling, Phase 2).
 *
 * Register/edit/list/pause/delete a car for scan-to-call. No OTP/SMS/call
 * verification yet — `contactVerified` stays `false`, a placeholder for the
 * missed-call verification wired up once telephony (Phase 4) lands. See
 * CLAUDE.md / the QR Calling blueprint for the full rollout plan.
 *
 * Plate, contact phone, medical notes, and emergency-contact phones are
 * application-encrypted at rest (AES-256-GCM, `lib/crypto.ts`); `plateHash`
 * is a keyed HMAC used for the exact-match unique lookup so the raw plate is
 * never queried directly.
 */
import { releaseVehicleStickers } from '../../lib/qrStickerRules.js';
import type { EmergencyContact, Prisma, QrSticker, VehicleRegistration } from '@prisma/client';
import { effectiveValidUntil } from '../../lib/qrValidity.js';
import type { RegisterVehicleInput } from '@ps/types';
import { normalizePlate } from '@ps/types';
import { prisma } from '../../lib/prisma.js';
import { BadRequest, Conflict, NotFound } from '../../lib/http.js';
import { decryptField, encryptField, hmacHash } from '../../lib/crypto.js';
import type { UpdateVehicleInput } from './vehicles.schema.js';
import { recordDetailChanges } from '../../lib/detailsChangeLog.js';

type RegistrationWithContacts = VehicleRegistration & {
  emergencyContacts: EmergencyContact[];
  qrStickers: Pick<QrSticker, 'id' | 'claimedAt'>[];
};

const toDTO = (row: RegistrationWithContacts) => ({
  id:              row.id,
  plateNumber:     decryptField(row.plateNumber),
  vehicleType:     row.vehicleType,
  contactPhone:    decryptField(row.contactPhone),
  contactVerified: row.contactVerified,
  status:          row.status,
  silentFrom:      row.silentFrom,
  silentTo:        row.silentTo,
  emergencyPublic: row.emergencyPublic,
  ownerName:       row.ownerName,
  bloodGroup:      row.bloodGroup,
  medicalNotes:    row.medicalNotes ? decryptField(row.medicalNotes) : null,
  validUntil:      effectiveValidUntil(row),
  validityCustom:  row.validUntil !== null,
  // Has the owner actually scanned + configured a physical QR sticker for
  // this car yet? (Separate from having *bought* one — see qrOrders.)
  qrLinked:        row.qrStickers.length > 0,
  qrLinkedAt:      row.qrStickers[0]?.claimedAt ?? null,
  emergencyContacts: [...row.emergencyContacts]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id:         c.id,
      name:       c.name,
      relation:   c.relation,
      phone:      decryptField(c.phone),
      showPublic: c.showPublic,
    })),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const INCLUDE = {
  emergencyContacts: true,
  qrStickers: { where: { status: 'CLAIMED' }, select: { id: true, claimedAt: true }, take: 1 },
} satisfies Prisma.VehicleRegistrationInclude;

const findOwned = async (userId: string, id: string) => {
  const row = await prisma.vehicleRegistration.findUnique({ where: { id }, include: INCLUDE });
  if (!row || row.userId !== userId) throw NotFound('Vehicle not found');
  return row;
};

export const listVehicles = async (userId: string) => {
  const rows = await prisma.vehicleRegistration.findMany({
    where:   { userId, status: { not: 'DELETED' } },
    include: INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toDTO);
};

export const getVehicle = async (userId: string, id: string) => {
  const row = await findOwned(userId, id);
  if (row.status === 'DELETED') throw NotFound('Vehicle not found');
  return toDTO(row);
};

/**
 * Used by the QR-sticker first-scan configure flow: once the owner types a
 * plate, check whether they already have a saved registration for it (added
 * earlier via My Vehicles, or a previous sticker) so the rest of the form —
 * silent hours, ICE card — can be pre-filled instead of re-typed. Never
 * reveals *whether* another account owns the plate, just "not found" either way.
 */
export const getVehicleByPlate = async (userId: string, plateRaw: string) => {
  const plateHash = hmacHash(normalizePlate(plateRaw));
  const row = await prisma.vehicleRegistration.findUnique({ where: { plateHash }, include: INCLUDE });
  if (!row || row.userId !== userId || row.status === 'DELETED') throw NotFound('Vehicle not found');
  return toDTO(row);
};

export const registerVehicle = async (userId: string, input: RegisterVehicleInput) => {
  const plateHash = hmacHash(input.plateNumber); // already normalized by the schema transform
  const dup = await prisma.vehicleRegistration.findUnique({ where: { plateHash } });
  if (dup && dup.status !== 'DELETED') {
    throw Conflict(
      dup.userId === userId
        ? 'You already have a registration for this car'
        : 'This car is already registered by another owner. Contact support if this is a mistake.',
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    // A soft-deleted registration for the same plate still occupies the
    // unique `plateHash` index — clear it out so the plate can be reused
    // (e.g. the previous owner deleted it, or the car changed hands).
    // Its sticker is released first (a hard delete would leave it "set up"
    // against nothing, and nobody could set it up again), and the same
    // owner's orders are re-pointed at the new record below.
    let ownOrderIds: string[] = [];
    if (dup) {
      await releaseVehicleStickers(tx, dup.id);
      if (dup.userId === userId) {
        ownOrderIds = (await tx.qrOrder.findMany({ where: { registrationId: dup.id, userId }, select: { id: true } })).map((o) => o.id);
      }
      await tx.vehicleRegistration.delete({ where: { id: dup.id } });
    }

    const reg = await tx.vehicleRegistration.create({
      data: {
        userId,
        plateHash,
        plateNumber:     encryptField(input.plateNumber),
        vehicleType:     input.vehicleType,
        contactPhone:    encryptField(input.contactPhone),
        ownerName:       input.ownerName || null,
        silentFrom:      input.silentFrom || null,
        silentTo:        input.silentTo || null,
        // dailyReceiveCap column keeps its DB default — no longer settable
        // per-car; the daily call cap is a global admin setting (lib/callLimits.ts).
        emergencyPublic: input.emergencyPublic,
        bloodGroup:      input.bloodGroup || null,
        medicalNotes:    input.medicalNotes ? encryptField(input.medicalNotes) : null,
        emergencyContacts: input.emergencyContacts?.length
          ? {
              create: input.emergencyContacts.map((c, i) => ({
                name:       c.name,
                relation:   c.relation || null,
                phone:      encryptField(c.phone),
                showPublic: c.showPublic,
                sortOrder:  i,
              })),
            }
          : undefined,
      },
      include: INCLUDE,
    });
    if (ownOrderIds.length) {
      await tx.qrOrder.updateMany({ where: { id: { in: ownOrderIds } }, data: { registrationId: reg.id } });
    }
    return reg;
  });

  return toDTO(created);
};

/** actorId: who is making the change (the owner by default; admin passes their own id). */
export const updateVehicle = async (userId: string, id: string, input: UpdateVehicleInput, actorId: string = userId) => {
  const existing = await findOwned(userId, id);
  if (existing.status === 'DELETED') throw BadRequest('This registration has been deleted');

  const data: Prisma.VehicleRegistrationUpdateInput = {};
  if (input.vehicleType !== undefined)     data.vehicleType     = input.vehicleType;
  if (input.contactPhone !== undefined)    data.contactPhone    = encryptField(input.contactPhone);
  if (input.ownerName !== undefined)       data.ownerName       = input.ownerName || null;
  if (input.silentFrom !== undefined)      data.silentFrom      = input.silentFrom || null;
  if (input.silentTo !== undefined)        data.silentTo        = input.silentTo || null;
  if (input.emergencyPublic !== undefined) data.emergencyPublic = input.emergencyPublic;
  if (input.bloodGroup !== undefined)      data.bloodGroup      = input.bloodGroup || null;
  if (input.medicalNotes !== undefined) {
    data.medicalNotes = input.medicalNotes ? encryptField(input.medicalNotes) : null;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.vehicleRegistration.update({ where: { id }, data });
    }
    // Whole-list replace — simplest correct semantics for a short ICE list (≤5).
    if (input.emergencyContacts !== undefined) {
      await tx.emergencyContact.deleteMany({ where: { registrationId: id } });
      if (input.emergencyContacts.length > 0) {
        await tx.emergencyContact.createMany({
          data: input.emergencyContacts.map((c, i) => ({
            registrationId: id,
            name:       c.name,
            relation:   c.relation || null,
            phone:      encryptField(c.phone),
            showPublic: c.showPublic,
            sortOrder:  i,
          })),
        });
      }
    }
  });

  // Change history: contact number, owner name and vehicle type (who, when, old -> new).
  await recordDetailChanges({
    actorId,
    entity: 'VehicleRegistration',
    entityId: id,
    changes: [
      ...(input.contactPhone !== undefined ? [{ field: 'contactPhone', label: 'Contact number', from: decryptField(existing.contactPhone), to: input.contactPhone }] : []),
      ...(input.ownerName !== undefined ? [{ field: 'ownerName', label: 'Owner name', from: existing.ownerName, to: input.ownerName || null }] : []),
      ...(input.vehicleType !== undefined ? [{ field: 'vehicleType', label: 'Vehicle type', from: existing.vehicleType, to: input.vehicleType }] : []),
    ],
  });

  // The vehicle's name and contact number are also the delivery name/phone on
  // its sticker orders. Move orders that used the old values to the new ones.
  if (input.contactPhone !== undefined) {
    const oldPhone = decryptField(existing.contactPhone);
    if (input.contactPhone !== oldPhone) {
      await prisma.qrOrder.updateMany({ where: { registrationId: id, shippingPhone: oldPhone }, data: { shippingPhone: input.contactPhone } });
    }
  }
  if (input.ownerName && existing.ownerName && input.ownerName !== existing.ownerName) {
    await prisma.qrOrder.updateMany({ where: { registrationId: id, shippingName: existing.ownerName }, data: { shippingName: input.ownerName } });
  }

  return getVehicle(userId, id);
};

const setStatus = async (userId: string, id: string, status: 'ACTIVE' | 'PAUSED') => {
  const existing = await findOwned(userId, id);
  if (existing.status === 'DELETED') throw BadRequest('This registration has been deleted');
  await prisma.vehicleRegistration.update({
    where: { id },
    data:  { status, isActive: status === 'ACTIVE' },
  });
  return getVehicle(userId, id);
};

export const pauseVehicle  = (userId: string, id: string) => setStatus(userId, id, 'PAUSED');
export const resumeVehicle = (userId: string, id: string) => setStatus(userId, id, 'ACTIVE');

// Soft delete only — keeps call history/audit trail intact. The plate's
// unique index is reclaimed (see registerVehicle) only if someone actually
// re-registers it, not eagerly here.
export const deleteVehicle = async (userId: string, id: string) => {
  const existing = await findOwned(userId, id);
  if (existing.status !== 'DELETED') {
    // The sticker on a deleted car is released, so it isn't stuck "set up"
    // against a removed vehicle. Only the original order's account can set it
    // up again (lib/qrStickerRules.ts).
    await prisma.$transaction(async (tx) => {
      await tx.vehicleRegistration.update({
        where: { id },
        data:  { status: 'DELETED', isActive: false, deactivatedAt: new Date() },
      });
      await releaseVehicleStickers(tx, id);
    });
  }
  return { deleted: true };
};
