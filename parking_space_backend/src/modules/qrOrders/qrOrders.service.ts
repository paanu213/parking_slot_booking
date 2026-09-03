/**
 * Sticker requests — "Get your QR sticker" landing page → registration +
 * shipping address, no online charge (see QrOrder's schema comment for why:
 * online payment is paused sitewide). Admin follows up to confirm payment
 * and ship. See CLAUDE.md / QR Calling blueprint.
 */
import { prisma } from '../../lib/prisma.js';
import { HttpError, NotFound } from '../../lib/http.js';
import { hmacHash } from '../../lib/crypto.js';
import * as vehiclesService from '../vehicles/vehicles.service.js';
import type { CreateQrOrderInput } from './qrOrders.schema.js';

/** Snapshot at request time — a later price change never rewrites past orders. */
export const STICKER_PRICE_PAISE = 29_900; // ₹299 one-time
export const MONTHLY_PRICE_PAISE = 5_000;  // ₹50/month call-service subscription

export const createQrOrder = async (userId: string, input: CreateQrOrderInput) => {
  // Register the car, but reuse an existing registration of this user's own
  // instead of failing if they already registered this plate (e.g. via "My
  // Vehicles") before finding this page.
  let registration;
  try {
    // orderVehicleSchema only picks 3 fields — fill in the rest of
    // RegisterVehicleInput's defaults explicitly (ICE stays off; the owner
    // can turn it on later from "My Vehicles").
    registration = await vehiclesService.registerVehicle(userId, { ...input.vehicle, emergencyPublic: false });
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      const plateHash = hmacHash(input.vehicle.plateNumber); // already normalized by the zod transform
      const existing = await prisma.vehicleRegistration.findUnique({ where: { plateHash } });
      if (existing && existing.userId === userId && existing.status !== 'DELETED') {
        registration = await vehiclesService.getVehicle(userId, existing.id);
      } else {
        throw e; // genuinely owned by someone else — surface the real conflict
      }
    } else {
      throw e;
    }
  }

  const order = await prisma.qrOrder.create({
    data: {
      userId,
      registrationId:    registration.id,
      stickerPricePaise: STICKER_PRICE_PAISE,
      monthlyPricePaise: MONTHLY_PRICE_PAISE,
      shippingName:  input.shippingName,
      shippingPhone: input.shippingPhone,
      addressLine:   input.addressLine,
      city:          input.city,
      state:         input.state,
      pincode:       input.pincode,
      note:          input.note ?? null,
    },
  });

  return { order, registration };
};

export const listMyQrOrders = async (userId: string) => {
  const rows = await prisma.qrOrder.findMany({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
  });
  return { items: rows };
};

export const getMyQrOrder = async (userId: string, id: string) => {
  const order = await prisma.qrOrder.findUnique({ where: { id } });
  if (!order || order.userId !== userId) throw NotFound('Order not found');
  return order;
};
