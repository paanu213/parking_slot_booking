-- Add a District field, distinct from City.
-- Historically `city` held the district (auto-filled from the pincode lookup,
-- which only returns District). Relocate that value into the new `district`
-- column and keep `city` unchanged so nothing breaks; admins/vendors correct
-- the real city over time via the edit forms.
ALTER TABLE `ParkingLocation` ADD COLUMN `district` VARCHAR(191) NULL;
UPDATE `ParkingLocation` SET `district` = `city` WHERE `district` IS NULL;
