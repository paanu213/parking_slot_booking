-- AlterTable: track the gateway's own refund id, set only after a real
-- refund is confirmed at the gateway (see admin.service refundBooking /
-- refundQrOrder).
ALTER TABLE `Payment` ADD COLUMN `providerRefundId` VARCHAR(191) NULL;
