-- Admin-created QR sticker orders: where the order came from, why, and how it is paid.
-- Additive only: existing rows default to WEBSITE / ONLINE.
ALTER TABLE `QrOrder` ADD COLUMN `source` ENUM('WEBSITE', 'ADMIN') NOT NULL DEFAULT 'WEBSITE',
    ADD COLUMN `channel` ENUM('INFLUENCER', 'CAMPAIGN', 'SUPPORT', 'OFFLINE_SALE', 'OTHER') NULL,
    ADD COLUMN `paymentMode` ENUM('ONLINE', 'OFFLINE', 'COMPLIMENTARY') NOT NULL DEFAULT 'ONLINE',
    ADD COLUMN `createdById` VARCHAR(191) NULL;
