/**
 * Safety rules for linking physical QR stickers to vehicles and orders.
 *
 * Invariants every code path must keep:
 *  1. A sticker is linked to at most one vehicle (QrSticker.registrationId).
 *  2. A vehicle has at most ONE active (CLAIMED) sticker. A different code
 *     only replaces it through the admin "Replace QR code" flow, which
 *     switches the old one off in the same transaction.
 *  3. A sticker is recorded against at most one order (QrOrder.dispatchedStickerId, unique).
 *  4. A sticker sent for an order can only be set up by that order's account,
 *     for that order's vehicle.
 *  5. Once a vehicle has a set-up sticker, its code can't be swapped by
 *     re-recording the dispatch; only by a replacement.
 *  6. Disabled stickers never come back to life by side effect (unbind, delete).
 */
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/** Accepts the printed code, or a full sticker URL (…/c/<code>) pasted from a scan. */
export const parseStickerCode = (raw: string) => {
  const s = raw.trim();
  const m = s.match(/\/c\/(?:t\/)?([A-Za-z0-9_-]{4,40})\/?(?:[?#].*)?$/);
  return m ? m[1] : s;
};

/**
 * Row lock on the vehicle for the rest of the transaction, so two sticker
 * links for the same car (two scans, or a scan racing an admin action) are
 * serialized and invariant 2 can't be broken by a race.
 */
export const lockVehicle = (tx: Tx, registrationId: string) =>
  tx.vehicleRegistration.update({ where: { id: registrationId }, data: { updatedAt: new Date() } });

/** The vehicle's active sticker, optionally ignoring one sticker id. */
export const activeStickerOf = (tx: Pick<Tx, 'qrSticker'>, registrationId: string, exceptStickerId?: string) =>
  tx.qrSticker.findFirst({
    where:  { registrationId, status: 'CLAIMED', ...(exceptStickerId ? { NOT: { id: exceptStickerId } } : {}) },
    select: { id: true, token: true },
  });

/**
 * Frees a vehicle's live stickers when the vehicle goes away (deleted, or its
 * plate re-registered), so the sticker isn't stuck "set up" against nothing.
 * Disabled stickers stay disabled. The dispatch record on the order is kept,
 * so only the original customer can set the sticker up again (invariant 4).
 */
export const releaseVehicleStickers = (tx: Tx, registrationId: string) =>
  tx.qrSticker.updateMany({
    where: { registrationId, status: 'CLAIMED' },
    data:  { status: 'UNCLAIMED', registrationId: null, claimedByUserId: null, claimedAt: null },
  });

/** Label of the batch that holds codes minted for "Replace QR code". */
export const REPLACEMENT_BATCH_LABEL = 'Replacement stickers';
