-- AlterTable: expand QrOrderStatus with granular pickup/dispatch/return stages.
-- Safe to redefine outright — every existing QrOrder row is currently PENDING.
ALTER TABLE `QrOrder` MODIFY COLUMN `status` ENUM('PENDING', 'CONFIRMED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable: rename shippedAt -> outForDeliveryAt (no data yet on any row) and add new tracking columns.
ALTER TABLE `QrOrder` CHANGE COLUMN `shippedAt` `outForDeliveryAt` DATETIME(3) NULL;
ALTER TABLE `QrOrder` ADD COLUMN `pickedUpAt` DATETIME(3) NULL;
ALTER TABLE `QrOrder` ADD COLUMN `returnedAt` DATETIME(3) NULL;
ALTER TABLE `QrOrder` ADD COLUMN `deliveryAttempt` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `QrOrderStatusEvent` (
    `id` VARCHAR(191) NOT NULL,
    `qrOrderId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED') NOT NULL,
    `note` TEXT NULL,
    `actorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QrOrderStatusEvent_qrOrderId_idx`(`qrOrderId`),
    INDEX `QrOrderStatusEvent_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QrOrderStatusEvent` ADD CONSTRAINT `QrOrderStatusEvent_qrOrderId_fkey` FOREIGN KEY (`qrOrderId`) REFERENCES `QrOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QrOrderStatusEvent` ADD CONSTRAINT `QrOrderStatusEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
