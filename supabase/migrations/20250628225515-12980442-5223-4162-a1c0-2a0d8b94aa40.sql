
-- Update vehicle type enum to support all GPS51 device types
ALTER TYPE vehicle_type ADD VALUE 'sedan';
ALTER TYPE vehicle_type ADD VALUE 'motorcycle';  
ALTER TYPE vehicle_type ADD VALUE 'other';

-- Ensure vehicles table supports the license_plate field properly
-- This should already exist, but let's make sure it's properly indexed
CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate ON vehicles(license_plate);
