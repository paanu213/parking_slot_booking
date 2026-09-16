-- AlterTable: track which physical sticker (by QrSticker.id) admin recorded
-- as dispatched for this order, independent of the customer's own claim.
ALTER TABLE `QrOrder` ADD COLUMN `dispatchedStickerId` VARCHAR(191) NULL;
ALTER TABLE `QrOrder` ADD COLUMN `dispatchedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `QrOrder_dispatchedStickerId_key` ON `QrOrder`(`dispatchedStickerId`);

-- AddForeignKey
ALTER TABLE `QrOrder` ADD CONSTRAINT `QrOrder_dispatchedStickerId_fkey` FOREIGN KEY (`dispatchedStickerId`) REFERENCES `QrSticker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
