-- AlterTable: allow a QrOrder's paymentStatus to record REFUNDED, mirroring
-- the existing Payment.status enum. Safe to redefine — no row currently uses
-- a value outside PENDING/PAID/FAILED.
ALTER TABLE `QrOrder` MODIFY COLUMN `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING';
