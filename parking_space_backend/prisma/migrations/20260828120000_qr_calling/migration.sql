-- CreateTable
CREATE TABLE `VehicleRegistration` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `plateHash` VARCHAR(191) NOT NULL,
    `plateNumber` TEXT NOT NULL,
    `contactPhone` TEXT NOT NULL,
    `contactVerified` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'PAUSED', 'TRANSFERRED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `dailyReceiveCap` INTEGER NOT NULL DEFAULT 15,
    `silentFrom` VARCHAR(191) NULL,
    `silentTo` VARCHAR(191) NULL,
    `emergencyPublic` BOOLEAN NOT NULL DEFAULT false,
    `ownerName` VARCHAR(191) NULL,
    `bloodGroup` VARCHAR(191) NULL,
    `medicalNotes` TEXT NULL,
    `deactivatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VehicleRegistration_plateHash_key`(`plateHash`),
    INDEX `VehicleRegistration_userId_idx`(`userId`),
    INDEX `VehicleRegistration_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmergencyContact` (
    `id` VARCHAR(191) NOT NULL,
    `registrationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(191) NULL,
    `phone` TEXT NOT NULL,
    `showPublic` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmergencyContact_registrationId_idx`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallSession` (
    `id` VARCHAR(191) NOT NULL,
    `registrationId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerCallId` VARCHAR(191) NULL,
    `virtualNumber` VARCHAR(191) NULL,
    `callerPhone` TEXT NOT NULL,
    `callerPhoneHash` VARCHAR(191) NULL,
    `callerIpHash` VARCHAR(191) NULL,
    `status` ENUM('INITIATED', 'RINGING_CALLER', 'CALLER_ANSWERED', 'RINGING_OWNER', 'BRIDGED', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'OWNER_REJECTED', 'FAILED', 'BLOCKED', 'CANCELLED') NOT NULL DEFAULT 'INITIATED',
    `hangupCause` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `initiatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `answeredAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `durationSec` INTEGER NULL,
    `recordingUrl` TEXT NULL,
    `costPaise` INTEGER NULL,
    `rawPayload` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CallSession_idempotencyKey_key`(`idempotencyKey`),
    INDEX `CallSession_registrationId_idx`(`registrationId`),
    INDEX `CallSession_status_idx`(`status`),
    INDEX `CallSession_providerCallId_idx`(`providerCallId`),
    INDEX `CallSession_callerPhoneHash_idx`(`callerPhoneHash`),
    INDEX `CallSession_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LookupAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `plateHash` VARCHAR(191) NULL,
    `ipHash` VARCHAR(191) NOT NULL,
    `outcome` ENUM('FOUND', 'NOT_FOUND', 'RATE_LIMITED', 'BOT_BLOCKED') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LookupAttempt_ipHash_createdAt_idx`(`ipHash`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockedNumber` (
    `id` VARCHAR(191) NOT NULL,
    `phoneHash` VARCHAR(191) NOT NULL,
    `scope` ENUM('REGISTRATION', 'GLOBAL') NOT NULL DEFAULT 'REGISTRATION',
    `registrationId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlockedNumber_phoneHash_idx`(`phoneHash`),
    INDEX `BlockedNumber_registrationId_idx`(`registrationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VirtualNumber` (
    `id` VARCHAR(191) NOT NULL,
    `e164` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `VirtualNumber_e164_key`(`e164`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VehicleRegistration` ADD CONSTRAINT `VehicleRegistration_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmergencyContact` ADD CONSTRAINT `EmergencyContact_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `VehicleRegistration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallSession` ADD CONSTRAINT `CallSession_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `VehicleRegistration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

