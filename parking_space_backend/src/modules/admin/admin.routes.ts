/**
 * Admin portal routes — dashboard, vendor approval/management, parking-space
 * approval, slots, bookings, payments, customers, amenities, admin-user
 * management and commission settings. Every route requires an authenticated
 * admin (SUPER_ADMIN / ADMIN / SUB_ADMIN); a few are SUPER_ADMIN-only. Handlers
 * are thin; logic lives in admin.service.
 *
 * Route order is preserved exactly — Express matches first-registered-wins, so
 * specific paths (e.g. /customers/guest) sit before parametric ones (/customers/:id).
 */
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { imageUpload } from '../../middleware/upload.js';
import {
  updateVendorSchema,
  vendorLeadStatusSchema,
  createVendorSchema,
  updateSpaceSchema,
  createLocationSchema,
  adminSlotSchema,
  updateSlotSchema,
  refundSchema,
  adminEditGuestSchema,
  updateRegisteredCustomerSchema,
  updateGuestCustomerSchema,
  createAdminSchema,
  commissionRateSchema,
  commissionStatusSchema,
} from './admin.schema.js';
import * as ctrl from './admin.controller.js';

const r = Router();
r.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'));

// --- Dashboard stats ---
r.get('/stats', ctrl.getStats);

// --- Vendor approval flow ---
r.get('/vendors', ctrl.listVendors);
r.get('/vendors/:id', ctrl.getVendor);
r.get('/vendors/:id/commission', ctrl.getVendorCommission);
r.post('/vendors/:id/approve', ctrl.approveVendor);
r.post('/vendors/:id/reject', ctrl.rejectVendor);
r.patch('/vendors/:id/status', ctrl.setVendorStatus);
r.patch('/vendors/:id', validate(updateVendorSchema), ctrl.updateVendor);
r.post('/vendors/:id/aadhaar/approve', ctrl.approveAadhaar);
r.post('/vendors/:id/aadhaar/reject', ctrl.rejectAadhaar);

// --- Vendor leads ("List your space" submissions from the customer site) ---
r.get('/vendor-leads', ctrl.listVendorLeads);
r.patch('/vendor-leads/:id', validate(vendorLeadStatusSchema), ctrl.updateVendorLead);

// --- Create vendor (admin action) ---
r.post('/vendors', validate(createVendorSchema), ctrl.createVendor);

// --- Vendor profile edit approval (vendor-submitted pending edits) ---
r.post('/vendors/:id/approve-profile', ctrl.approveVendorProfile);
r.post('/vendors/:id/reject-profile', ctrl.rejectVendorProfile);

// --- Parking space approval flow ---
r.get('/spaces/:id', ctrl.getSpace);
r.get('/spaces/:id/details', ctrl.getSpaceDetails);
r.get('/spaces', ctrl.listSpaces);
r.post('/spaces/:id/approve', ctrl.approveSpace);
r.post('/spaces/:id/reject', ctrl.rejectSpace);
r.post('/spaces/:id/reject-edits', ctrl.rejectSpaceEdits);
r.patch('/spaces/:id', validate(updateSpaceSchema), ctrl.updateSpace);

// --- Admin: create a parking space for any approved vendor (auto-approved) ---
r.post('/locations', validate(createLocationSchema), ctrl.createLocation);

// --- Admin location images ---
r.post('/locations/:id/images', imageUpload.array('files', 10), ctrl.addLocationImages);
r.delete('/locations/:id/images/:imageId', ctrl.deleteLocationImage);

// --- Admin amenities for a location ---
r.put('/locations/:id/amenities', ctrl.setLocationAmenities);

// --- Admin slot management ---
r.post('/locations/:id/slots', validate(adminSlotSchema), ctrl.createSlot);
r.delete('/slots/:id', ctrl.deleteSlot);

// --- Locations & slots (any vendor's) ---
r.patch('/locations/:id/status', ctrl.setLocationStatus);
r.patch('/slots/:id/status', ctrl.setSlotStatus);
r.patch('/slots/:id', validate(updateSlotSchema), ctrl.updateSlot);
r.get('/slots/:id/bookings', ctrl.getSlotBookings);

// --- Bookings & payments overview ---
r.get('/bookings', ctrl.listBookings);
r.get('/payments', ctrl.listPayments);
r.patch('/bookings/:id/payment-method', ctrl.setBookingPaymentMethod);
r.post('/bookings/:id/refund', validate(refundSchema), ctrl.refundBooking);
r.patch('/bookings/:id/guest', validate(adminEditGuestSchema), ctrl.editBookingGuest);
r.patch('/bookings/:id/cancel', ctrl.cancelBooking);

// --- Customer list & details ---
// NOTE: literal /customers/guest* paths MUST be registered before the parametric
// /customers/:id routes, otherwise Express matches `guest` as an :id and shadows them.
r.get('/customers', ctrl.listCustomers);
r.get('/customers/guest/:phone', ctrl.getGuestCustomer);
r.patch('/customers/guest', validate(updateGuestCustomerSchema), ctrl.updateGuestCustomer);
r.get('/customers/:id', ctrl.getCustomer);
r.patch('/customers/:id', validate(updateRegisteredCustomerSchema), ctrl.updateRegisteredCustomer);
r.patch('/customers/:id/status', ctrl.toggleCustomerStatus);

// --- Amenities master list (admin-managed) ---
r.get('/amenities', ctrl.listAmenities);
r.post('/amenities', ctrl.createAmenity);
r.patch('/amenities/:id', ctrl.updateAmenity);
r.delete('/amenities/:id', ctrl.deleteAmenity);

// --- Admin / Sub-Admin management ---
r.get('/admins', ctrl.listAdmins);
r.post('/admins', requireRole('SUPER_ADMIN'), validate(createAdminSchema), ctrl.createAdmin);
r.patch('/admins/:id/status', requireRole('SUPER_ADMIN'), ctrl.setAdminStatus);
r.delete('/admins/:id', requireRole('SUPER_ADMIN'), ctrl.deleteAdmin);

// --- Commission settings ---
r.get('/settings/commission', ctrl.getCommissionSetting);
r.patch('/settings/commission', validate(commissionRateSchema), ctrl.updateCommissionSetting);
r.patch('/bookings/:id/commission', validate(commissionStatusSchema), ctrl.setBookingCommissionStatus);
r.get('/commission/summary', ctrl.commissionSummary);
r.get('/commission/bookings', ctrl.commissionBookings);

export default r;
