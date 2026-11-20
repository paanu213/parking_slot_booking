-- Order type is kept for every order: website orders get WEBSITE.
-- 1) allow the new value, 2) backfill existing rows, 3) make it required with a default.
ALTER TABLE `QrOrder` MODIFY `channel` ENUM('WEBSITE', 'INFLUENCER', 'CAMPAIGN', 'SUPPORT', 'OFFLINE_SALE', 'OTHER') NULL;
UPDATE `QrOrder` SET `channel` = 'WEBSITE' WHERE `channel` IS NULL;
ALTER TABLE `QrOrder` MODIFY `channel` ENUM('WEBSITE', 'INFLUENCER', 'CAMPAIGN', 'SUPPORT', 'OFFLINE_SALE', 'OTHER') NOT NULL DEFAULT 'WEBSITE';
