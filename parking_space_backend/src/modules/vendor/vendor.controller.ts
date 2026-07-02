import type { RequestHandler } from 'express';
import * as service from './vendor.service.js';
import type {
  AadhaarUploadInput,
  LocationInput,
  SlotInput,
  SlotUpdateInput,
  DirectBookingInput,
  EditGuestInput,
} from './vendor.schema.js';

// ── Profile ──────────────────────────────────────────────────────────────────
export const getProfile: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getProfile(req.user!.sub));
  } catch (e) {
    next(e);
  }
};

export const updateProfile: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateProfile(req.user!.sub, req.body));
  } catch (e) {
    next(e);
  }
};

export const withdrawProfileEdits: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.withdrawProfileEdits(req.user!.sub));
  } catch (e) {
    next(e);
  }
};

export const uploadAadhaar: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.uploadAadhaar(req.user!.sub, req.body as AadhaarUploadInput));
  } catch (e) {
    next(e);
  }
};

// ── Locations ────────────────────────────────────────────────────────────────
export const createLocation: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createLocation(req.user!.sub, req.body as LocationInput));
  } catch (e) {
    next(e);
  }
};

export const listLocations: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listLocations(req.user!.sub));
  } catch (e) {
    next(e);
  }
};

export const deleteLocation: RequestHandler = async (req, res, next) => {
  try {
    await service.deleteLocation(req.user!.sub, req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

export const updateLocation: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateLocation(req.user!.sub, req.params.id, req.body as LocationInput));
  } catch (e) {
    next(e);
  }
};

export const toggleLocationStatus: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.toggleLocationStatus(req.user!.sub, req.params.id, Boolean(req.body?.isActive)));
  } catch (e) {
    next(e);
  }
};

// ── Slots ─────────────────────────────────────────────────────────────────
export const createSlot: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createSlot(req.user!.sub, req.params.id, req.body as SlotInput));
  } catch (e) {
    next(e);
  }
};

export const updateSlot: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateSlot(req.user!.sub, req.params.slotId, req.body as SlotUpdateInput));
  } catch (e) {
    next(e);
  }
};

export const updateSlotStatus: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateSlotStatus(req.user!.sub, req.params.slotId, req.body?.status));
  } catch (e) {
    next(e);
  }
};

export const getSlotBookings: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getSlotBookings(req.user!.sub, req.params.slotId));
  } catch (e) {
    next(e);
  }
};

// ── Images ────────────────────────────────────────────────────────────────
export const addLocationImages: RequestHandler = async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    res.status(201).json(await service.addLocationImages(req.user!.sub, req.params.id, files));
  } catch (e) {
    next(e);
  }
};

export const deleteLocationImage: RequestHandler = async (req, res, next) => {
  try {
    await service.deleteLocationImage(req.user!.sub, req.params.id, req.params.imageId);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

// ── Amenities ───────────────────────────────────────────────────────────────
export const listAmenities: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listAmenities());
  } catch (e) {
    next(e);
  }
};

export const setLocationAmenities: RequestHandler = async (req, res, next) => {
  try {
    const amenityIds: string[] = req.body?.amenityIds ?? [];
    res.json(await service.setLocationAmenities(req.user!.sub, req.params.id, amenityIds));
  } catch (e) {
    next(e);
  }
};

// ── Bookings & commission ─────────────────────────────────────────────────
export const listBookings: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listBookings(req.user!.sub));
  } catch (e) {
    next(e);
  }
};

export const commissionSummary: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.commissionSummary(
      req.user!.sub,
      req.query.period as string | undefined,
      req.query.from   as string | undefined,
      req.query.to     as string | undefined,
    ));
  } catch (e) {
    next(e);
  }
};

export const createDirectBooking: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createDirectBooking(req.user!.sub, req.body as DirectBookingInput));
  } catch (e) {
    next(e);
  }
};

export const editGuestBooking: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.editGuestBooking(req.user!.sub, req.params.id, req.body as EditGuestInput));
  } catch (e) {
    next(e);
  }
};

export const cancelBooking: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.cancelBooking(req.user!.sub, req.params.id, req.body?.reason as string | undefined));
  } catch (e) {
    next(e);
  }
};
