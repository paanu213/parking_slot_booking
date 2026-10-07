-- Car vs bike for each QR registration. Additive with a default, so the
-- currently deployed backend (which doesn't know this column) keeps working.
ALTER TABLE `VehicleRegistration` ADD COLUMN `vehicleType` ENUM('CAR', 'BIKE') NOT NULL DEFAULT 'CAR';
