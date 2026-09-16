-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `failureCode` VARCHAR(191) NULL,
    ADD COLUMN `failureReason` TEXT NULL,
    ADD COLUMN `ipHash` VARCHAR(191) NULL,
    ADD COLUMN `qrOrderId` VARCHAR(191) NULL,
    ADD COLUMN `userAgent` TEXT NULL,
    MODIFY `bookingId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Payment_qrOrderId_idx` ON `Payment`(`qrOrderId`);

-- CreateIndex
CREATE INDEX `Payment_providerOrderId_idx` ON `Payment`(`providerOrderId`);

-- CreateIndex
CREATE INDEX `Payment_providerPaymentId_idx` ON `Payment`(`providerPaymentId`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_qrOrderId_fkey` FOREIGN KEY (`qrOrderId`) REFERENCES `QrOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
