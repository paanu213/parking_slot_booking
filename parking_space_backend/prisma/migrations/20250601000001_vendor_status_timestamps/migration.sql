-- AlterTable
ALTER TABLE `Vendor` ADD COLUMN `deactivatedAt` DATETIME(3) NULL,
    ADD COLUMN `deactivatedById` VARCHAR(191) NULL,
    ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectedById` VARCHAR(191) NULL;

