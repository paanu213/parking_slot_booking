-- Performance: indexes for the date-sorted admin lists and dashboard counts.
-- Additive only (no data changes).
CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog`(`createdAt`);
CREATE INDEX `Booking_createdAt_idx` ON `Booking`(`createdAt`);
CREATE INDEX `Booking_status_createdAt_idx` ON `Booking`(`status`, `createdAt`);
CREATE INDEX `Payment_status_createdAt_idx` ON `Payment`(`status`, `createdAt`);
CREATE INDEX `QrOrder_createdAt_idx` ON `QrOrder`(`createdAt`);
CREATE INDEX `QrOrder_paymentStatus_createdAt_idx` ON `QrOrder`(`paymentStatus`, `createdAt`);
