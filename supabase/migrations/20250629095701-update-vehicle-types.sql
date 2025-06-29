
-- Update the vehicle_type enum to include all supported types
DO $$ BEGIN
    -- Check if the enum type exists and alter it
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type') THEN
        -- Add new enum values if they don't exist
        BEGIN
            ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'sedan';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'motorcycle';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
        
        BEGIN
            ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'other';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- Ensure the unique constraint exists for gps51_device_id (if not already created)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'vehicles_gps51_device_id_unique'
    ) THEN
        ALTER TABLE public.vehicles 
        ADD CONSTRAINT vehicles_gps51_device_id_unique 
        UNIQUE (gps51_device_id);
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_vehicles_gps51_device_id_lookup 
ON public.vehicles(gps51_device_id) 
WHERE gps51_device_id IS NOT NULL;
