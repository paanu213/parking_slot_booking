-- "List your space" requests now require sign-in: link each lead to the submitting account.
-- Additive and nullable: existing leads keep userId = NULL.
ALTER TABLE `VendorLead` ADD COLUMN `userId` VARCHAR(191) NULL;

CREATE INDEX `VendorLead_userId_idx` ON `VendorLead`(`userId`);

ALTER TABLE `VendorLead` ADD CONSTRAINT `VendorLead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
