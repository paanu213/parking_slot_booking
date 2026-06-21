/**
 * Vendor portal routes — profile, locations, slots, images, amenities,
 * commission summary and direct (walk-in) bookings. All routes require an
 * authenticated VENDOR. Handlers are thin; logic lives in vendor.service.
 */
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { imageUpload } from '../../middleware/upload.js';
import {
  updateProfileSchema,
  aadhaarUploadSchema,
  locationSchema,
  slotSchema,
  slotUpdateSchema,
  directBookingSchema,
  editGuestSchema,
} from './vendor.schema.js';
import * as ctrl from './vendor.controller.js';

const r = Router();
r.use(requireAuth, requireRole('VENDOR'));

// Profile
r.get('/me', ctrl.getProfile);
r.put('/me', validate(updateProfileSchema), ctrl.updateProfile);
r.post('/me/aadhaar', validate(aadhaarUploadSchema), ctrl.uploadAadhaar);

// Locations CRUD (vendor-scoped)
r.post('/locations', validate(locationSchema), ctrl.createLocation);
r.get('/locations', ctrl.listLocations);
r.delete('/locations/:id', ctrl.deleteLocation);
r.put('/locations/:id', validate(locationSchema), ctrl.updateLocation);
r.patch('/locations/:id/status', ctrl.toggleLocationStatus);

// Slots
r.post('/locations/:id/slots', validate(slotSchema), ctrl.createSlot);
r.patch('/slots/:slotId', validate(slotUpdateSchema), ctrl.updateSlot);
r.patch('/slots/:slotId/status', ctrl.updateSlotStatus);
r.get('/slots/:slotId/bookings', ctrl.getSlotBookings);

// Location images
r.post('/locations/:id/images', imageUpload.array('files', 10), ctrl.addLocationImages);
r.delete('/locations/:id/images/:imageId', ctrl.deleteLocationImage);

// Amenities
r.get('/amenities', ctrl.listAmenities);
r.put('/locations/:id/amenities', ctrl.setLocationAmenities);

// Bookings & commission
r.get('/bookings', ctrl.listBookings);
r.get('/commission/summary', ctrl.commissionSummary);
r.post('/direct-bookings', validate(directBookingSchema), ctrl.createDirectBooking);
r.patch('/bookings/:id/guest', validate(editGuestSchema), ctrl.editGuestBooking);
r.patch('/bookings/:id/cancel', ctrl.cancelBooking);

export default r;
