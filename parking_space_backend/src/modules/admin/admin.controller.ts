import type { RequestHandler } from 'express';
import * as service from './admin.service.js';
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
  CallDailyCapInput,
  SetVehicleValidityInput,
  QrVehicleStatusInput,
  QrVehicleContactInput,
  BlockCallGloballyInput,
  SetQrOrderStatusInput,
  DispatchStickerInput,
  GenerateQrBatchInput,
  UpdateQrBatchInput,
  QrStickerDisableInput,
} from './admin.schema.js';

// ── Dashboard stats ─────────────────────────────────────────────────────────
export const getStats: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getStats(req.query.start as string | undefined, req.query.end as string | undefined));
  } catch (e) {
    next(e);
  }
};

// ── Vendors ─────────────────────────────────────────────────────────────────
export const listVendors: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listVendors(req.query.status as string | undefined));
  } catch (e) {
    next(e);
  }
};

export const getVendor: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getVendor(req.params.id));
  } catch (e) {
    next(e);
  }
};

export const getVendorCommission: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getVendorCommission(
      req.params.id,
      req.query.period as string | undefined,
      req.query.from   as string | undefined,
      req.query.to     as string | undefined,
    ));
  } catch (e) {
    next(e);
  }
};

export const approveVendor: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.approveVendor(req.params.id, req.user!.sub));
  } catch (e) {
    next(e);
  }
};

export const rejectVendor: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.rejectVendor(req.params.id, req.user!.sub, req.body?.note));
  } catch (e) {
    next(e);
  }
};

export const setVendorStatus: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.setVendorStatus(req.params.id, req.user!.sub, req.body?.status));
  } catch (e) {
    next(e);
  }
};

export const updateVendor: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateVendor(req.params.id, req.user!.sub, req.body as UpdateVendorInput));
  } catch (e) {
    next(e);
  }
};

export const approveAadhaar: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.approveAadhaar(req.params.id, req.user!.sub));
  } catch (e) {
    next(e);
  }
};

export const rejectAadhaar: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.rejectAadhaar(req.params.id, req.user!.sub));
  } catch (e) {
    next(e);
  }
};

// ── Vendor leads ────────────────────────────────────────────────────────────
export const listVendorLeads: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listVendorLeads(
      req.query.status as string | undefined,
      req.query.type as string | undefined,
    ));
  } catch (e) {
    next(e);
  }
};

export const updateVendorLead: RequestHandler = async (req, res, next) => {
  try {
    const { status } = req.body as VendorLeadStatusInput;
    res.json(await service.updateVendorLead(req.params.id, req.user!.sub, status));
  } catch (e) {
    next(e);
  }
};

export const createVendor: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createVendor(req.user!.sub, req.body as CreateVendorInput));
  } catch (e) {
    next(e);
  }
};

export const approveVendorProfile: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.approveVendorProfile(req.params.id, req.user!.sub));
  } catch (e) {
    next(e);
  }
};

export const rejectVendorProfile: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.rejectVendorProfile(req.params.id, req.user!.sub, req.body?.note));
  } catch (e) {
    next(e);
  }
};

// ── Parking spaces ────────────────────────────────────────────────────────────
export const getSpace: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getSpace(req.params.id));
  } catch (e) {
    next(e);
  }
};

export const getSpaceDetails: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getSpaceDetails(req.params.id));
  } catch (e) {
    next(e);
  }
};

export const listSpaces: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listSpaces(
      req.query.status   as string | undefined,
      req.query.vendorId as string | undefined,
    ));
  } catch (e) {
    next(e);
  }
};

export const approveSpace: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.approveSpace(req.params.id, req.user!.sub));
  } catch (e) {
    next(e);
  }
};

export const rejectSpace: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.rejectSpace(req.params.id, req.user!.sub, req.body?.note));
  } catch (e) {
    next(e);
  }
};

export const rejectSpaceEdits: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.rejectSpaceEdits(req.params.id, req.user!.sub, req.body?.note));
  } catch (e) {
    next(e);
  }
};

export const updateSpace: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateSpace(req.params.id, req.user!.sub, req.body as UpdateSpaceInput));
  } catch (e) {
    next(e);
  }
};

export const createLocation: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createLocation(req.user!.sub, req.body as CreateLocationInput));
  } catch (e) {
    next(e);
  }
};

// ── Location images / amenities / slots ───────────────────────────────────────
export const addLocationImages: RequestHandler = async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    res.status(201).json(await service.addLocationImages(req.params.id, files));
  } catch (e) {
    next(e);
  }
};

export const deleteLocationImage: RequestHandler = async (req, res, next) => {
  try {
    await service.deleteLocationImage(req.params.id, req.params.imageId);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

export const setLocationAmenities: RequestHandler = async (req, res, next) => {
  try {
    const amenityIds: string[] = req.body?.amenityIds ?? [];
    res.json(await service.setLocationAmenities(req.params.id, amenityIds));
  } catch (e) {
    next(e);
  }
};

export const createSlot: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createSlot(req.params.id, req.body as AdminSlotInput));
  } catch (e) {
    next(e);
  }
};

export const deleteSlot: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.deleteSlot(req.params.id));
  } catch (e) {
    next(e);
  }
};

export const setLocationStatus: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.setLocationStatus(req.params.id, Boolean(req.body?.isActive)));
  } catch (e) {
    next(e);
  }
};

export const setSlotStatus: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.setSlotStatus(req.params.id, req.body?.status));
  } catch (e) {
    next(e);
  }
};

export const updateSlot: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateSlot(req.params.id, req.body as UpdateSlotInput));
  } catch (e) {
    next(e);
  }
};

export const getSlotBookings: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getSlotBookings(req.params.id));
  } catch (e) {
    next(e);
  }
};

// ── Bookings & payments ───────────────────────────────────────────────────────
export const listBookings: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listBookings());
  } catch (e) {
    next(e);
  }
};

export const listPayments: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listPayments());
  } catch (e) {
    next(e);
  }
};

export const setBookingPaymentMethod: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.setBookingPaymentMethod(req.params.id, req.body?.paymentMethod ?? ''));
  } catch (e) {
    next(e);
  }
};

export const refundBooking: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.refundBooking(req.params.id, req.user!.sub, req.body as RefundInput));
  } catch (e) {
    next(e);
  }
};

export const editBookingGuest: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.editBookingGuest(req.params.id, req.user!.sub, req.body as AdminEditGuestInput));
  } catch (e) {
    next(e);
  }
};

export const cancelBooking: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.cancelBooking(req.params.id, req.user!.sub, req.body?.reason as string | undefined));
  } catch (e) {
    next(e);
  }
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const listCustomers: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listCustomers(req.query.search as string | undefined));
  } catch (e) {
    next(e);
  }
};

export const getCustomer: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getCustomer(req.params.id));
  } catch (e) {
    next(e);
  }
};

export const getGuestCustomer: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getGuestCustomer(req.params.phone));
  } catch (e) {
    next(e);
  }
};

export const updateRegisteredCustomer: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateRegisteredCustomer(req.params.id, req.user!.sub, req.body as UpdateRegisteredCustomerInput));
  } catch (e) {
    next(e);
  }
};

export const updateGuestCustomer: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateGuestCustomer(req.user!.sub, req.body as UpdateGuestCustomerInput));
  } catch (e) {
    next(e);
  }
};

export const toggleCustomerStatus: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.toggleCustomerStatus(req.params.id, req.user!.sub));
  } catch (e) {
    next(e);
  }
};

// ── Amenities master list ─────────────────────────────────────────────────────
export const listAmenities: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listAmenities());
  } catch (e) {
    next(e);
  }
};

export const createAmenity: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createAmenity(req.body.name, req.body.iconName, req.body.description));
  } catch (e) {
    next(e);
  }
};

export const updateAmenity: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateAmenity(req.params.id, req.body.iconName));
  } catch (e) {
    next(e);
  }
};

export const deleteAmenity: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.deleteAmenity(req.params.id));
  } catch (e) {
    next(e);
  }
};

// ── Admin / Sub-Admin management ──────────────────────────────────────────────
export const listAdmins: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listAdmins());
  } catch (e) {
    next(e);
  }
};

export const createAdmin: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.createAdmin(req.body as CreateAdminInput));
  } catch (e) {
    next(e);
  }
};

export const setAdminStatus: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.setAdminStatus(req.params.id, req.body?.status));
  } catch (e) {
    next(e);
  }
};

export const deleteAdmin: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.deleteAdmin(req.params.id, req.user!.sub));
  } catch (e) {
    next(e);
  }
};

// ── Commission settings ───────────────────────────────────────────────────────
export const getCommissionSetting: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.getCommissionSetting());
  } catch (e) {
    next(e);
  }
};

export const updateCommissionSetting: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateCommissionSetting(req.user!.sub, Number(req.body.rate)));
  } catch (e) {
    next(e);
  }
};

export const setBookingCommissionStatus: RequestHandler = async (req, res, next) => {
  try {
    const status = req.body.status as CommissionStatusInput['status'];
    res.json(await service.setBookingCommissionStatus(req.params.id, req.user!.sub, status));
  } catch (e) {
    next(e);
  }
};

export const commissionSummary: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.commissionSummary(
      req.query.period as string | undefined,
      req.query.from   as string | undefined,
      req.query.to     as string | undefined,
    ));
  } catch (e) {
    next(e);
  }
};

export const commissionBookings: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.commissionBookings(
      req.query.period as string | undefined,
      req.query.from   as string | undefined,
      req.query.to     as string | undefined,
      req.query.status as string | undefined,
    ));
  } catch (e) {
    next(e);
  }
};

// ── QR Calling ───────────────────────────────────────────────────────────────
export const qrOverview: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.qrOverview());
  } catch (e) { next(e); }
};

export const listQrVehicles: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listQrVehicles(
      req.query.search as string | undefined,
      req.query.status as string | undefined,
    ));
  } catch (e) { next(e); }
};

export const getQrVehicle: RequestHandler = async (req, res, next) => {
  try {
    res.json({ vehicle: await service.getQrVehicle(req.params.id) });
  } catch (e) { next(e); }
};

export const reassignQrVehicle: RequestHandler = async (req, res, next) => {
  try {
    const vehicle = await service.reassignQrVehicle(req.params.id, req.user!.sub, req.body as ReassignVehicleInput);
    res.json({ vehicle });
  } catch (e) { next(e); }
};

export const getCallDailyCapSetting: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.getCallDailyCapSetting());
  } catch (e) { next(e); }
};

export const updateCallDailyCapSetting: RequestHandler = async (req, res, next) => {
  try {
    const { dailyCap } = req.body as CallDailyCapInput;
    res.json(await service.updateCallDailyCapSetting(req.user!.sub, dailyCap));
  } catch (e) { next(e); }
};

export const setVehicleValidity: RequestHandler = async (req, res, next) => {
  try {
    const { validUntil } = req.body as SetVehicleValidityInput;
    const vehicle = await service.setVehicleValidity(req.params.id, req.user!.sub, validUntil);
    res.json({ vehicle });
  } catch (e) { next(e); }
};

export const setQrVehicleStatus: RequestHandler = async (req, res, next) => {
  try {
    const { status } = req.body as QrVehicleStatusInput;
    const vehicle = await service.setQrVehicleStatus(req.params.id, req.user!.sub, status);
    res.json({ vehicle });
  } catch (e) { next(e); }
};

export const updateQrVehicleContact: RequestHandler = async (req, res, next) => {
  try {
    const { contactPhone } = req.body as QrVehicleContactInput;
    const vehicle = await service.updateQrVehicleContact(req.params.id, req.user!.sub, contactPhone);
    res.json({ vehicle });
  } catch (e) { next(e); }
};

export const listQrCalls: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listQrCalls(req.query.status as string | undefined));
  } catch (e) { next(e); }
};

export const blockQrCallGlobally: RequestHandler = async (req, res, next) => {
  try {
    const { reason } = req.body as BlockCallGloballyInput;
    res.json(await service.blockQrCallGlobally(req.params.id, req.user!.sub, reason));
  } catch (e) { next(e); }
};

export const revealQrCallerNumber: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.revealQrCallerNumber(req.params.id, req.user!.sub));
  } catch (e) { next(e); }
};

export const listQrBlockedNumbers: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listQrBlockedNumbers());
  } catch (e) { next(e); }
};

export const unblockQrNumber: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.unblockQrNumber(req.params.id, req.user!.sub));
  } catch (e) { next(e); }
};

export const listQrOrders: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listQrOrders({
      status:        req.query.status as string | undefined,
      paymentStatus: req.query.paymentStatus as string | undefined,
    }));
  } catch (e) { next(e); }
};

export const listQrPayments: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listQrPayments(
      req.query.status as string | undefined,
      req.query.q as string | undefined,
    ));
  } catch (e) { next(e); }
};

export const setQrOrderStatus: RequestHandler = async (req, res, next) => {
  try {
    const { status, note } = req.body as SetQrOrderStatusInput;
    res.json(await service.setQrOrderStatus(req.params.id, req.user!.sub, status, note));
  } catch (e) { next(e); }
};

export const refundQrOrder: RequestHandler = async (req, res, next) => {
  try {
    const { amount, note } = req.body as RefundInput;
    res.json(await service.refundQrOrder(req.params.id, req.user!.sub, amount, note));
  } catch (e) { next(e); }
};

export const dispatchQrOrderSticker: RequestHandler = async (req, res, next) => {
  try {
    const { token } = req.body as DispatchStickerInput;
    res.json(await service.dispatchQrOrderSticker(req.params.id, req.user!.sub, token));
  } catch (e) { next(e); }
};

export const listQrOrderEvents: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listQrOrderEvents(req.params.id));
  } catch (e) { next(e); }
};

// ── QR sticker batches ──────────────────────────────────────────────────────
export const generateQrBatch: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.generateQrBatch(req.user!.sub, req.body as GenerateQrBatchInput));
  } catch (e) { next(e); }
};

export const listQrBatches: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listQrBatches());
  } catch (e) { next(e); }
};

export const updateQrBatch: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.updateQrBatch(req.params.id, req.user!.sub, req.body as UpdateQrBatchInput));
  } catch (e) { next(e); }
};

export const exportQrBatch: RequestHandler = async (req, res, next) => {
  try {
    const { filename, csv } = await service.exportQrBatch(req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) { next(e); }
};

export const listQrBatchTokens: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listQrBatchTokens(req.params.id));
  } catch (e) { next(e); }
};

export const listQrStickers: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listQrStickers({
      q:       req.query.q as string | undefined,
      status:  req.query.status as string | undefined,
      batchId: req.query.batchId as string | undefined,
    }));
  } catch (e) { next(e); }
};

export const unbindQrSticker: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.unbindQrSticker(req.params.id, req.user!.sub));
  } catch (e) { next(e); }
};

export const setQrStickerDisabled: RequestHandler = async (req, res, next) => {
  try {
    const { disabled, reason } = req.body as QrStickerDisableInput;
    res.json(await service.setQrStickerDisabled(req.params.id, req.user!.sub, disabled, reason));
  } catch (e) { next(e); }
};

export const listAuditLogs: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listAuditLogs({
      q:      req.query.q as string | undefined,
      entity: req.query.entity as string | undefined,
      action: req.query.action as string | undefined,
    }));
  } catch (e) { next(e); }
};

export const listAuditLogEntities: RequestHandler = async (_req, res, next) => {
  try {
    res.json(await service.listAuditLogEntities());
  } catch (e) { next(e); }
};
