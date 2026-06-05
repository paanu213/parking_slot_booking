-- CreateTable
CREATE TABLE `SavedSpace` (
    `userId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `savedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SavedSpace_userId_idx`(`userId`),
    PRIMARY KEY (`userId`, `locationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SavedSpace` ADD CONSTRAINT `SavedSpace_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavedSpace` ADD CONSTRAINT `SavedSpace_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `ParkingLocation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

