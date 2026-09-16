-- AlterTable
ALTER TABLE `QrOrder` ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `paymentRef` VARCHAR(191) NULL,
    ADD COLUMN `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `QrBatch` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `note` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `printedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QrBatch_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QrSticker` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `status` ENUM('UNCLAIMED', 'CLAIMED', 'DISABLED') NOT NULL DEFAULT 'UNCLAIMED',
    `registrationId` VARCHAR(191) NULL,
    `claimedByUserId` VARCHAR(191) NULL,
    `claimedAt` DATETIME(3) NULL,
    `disabledAt` DATETIME(3) NULL,
    `disabledReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QrSticker_token_key`(`token`),
    INDEX `QrSticker_batchId_idx`(`batchId`),
    INDEX `QrSticker_status_idx`(`status`),
    INDEX `QrSticker_registrationId_idx`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QrSticker` ADD CONSTRAINT `QrSticker_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `QrBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QrSticker` ADD CONSTRAINT `QrSticker_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `VehicleRegistration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
