-- AlterTable
ALTER TABLE `Vendor` ADD COLUMN `aadharVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `aadharVerifiedById` VARCHAR(191) NULL;

-- Backfill: any Aadhaar doc uploaded before this verification feature existed is
-- treated as already verified, so existing vendors don't regress to "pending".
UPDATE `Vendor` SET `aadharVerifiedAt` = NOW()
  WHERE `aadharDocUrl` IS NOT NULL AND `aadharDocUrl` <> '';
