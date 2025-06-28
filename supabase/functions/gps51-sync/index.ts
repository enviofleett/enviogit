
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51Config {
  baseUrl: string;
  apiKey: string;
}

interface GPS51Vehicle {
  id: string;
  name: string;
  plate: string;
  type: string;
  status: string;
}

interface GPS51Position {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  ignition: boolean;
  fuel?: number;
  temperature?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting GPS51 sync process...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // GPS51 API configuration
    const gps51Config: GPS51Config = {
      baseUrl: Deno.env.get('GPS51_API_URL') || 'https://api.gps51.com/v1',
      apiKey: Deno.env.get('GPS51_API_KEY')!,
    };

    if (!gps51Config.apiKey) {
      throw new Error('GPS51_API_KEY environment variable is required');
    }

    // Fetch vehicles from GPS51
    console.log('Fetching vehicles from GPS51...');
    const vehiclesResponse = await fetch(`${gps51Config.baseUrl}/vehicles`, {
      headers: {
        'Authorization': `Bearer ${gps51Config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!vehiclesResponse.ok) {
      throw new Error(`GPS51 API error: ${vehiclesResponse.status}`);
    }

    const gps51Vehicles: GPS51Vehicle[] = await vehiclesResponse.json();
    console.log(`Found ${gps51Vehicles.length} vehicles in GPS51`);

    // Sync vehicles to database
    for (const gps51Vehicle of gps51Vehicles) {
      const vehicleData = {
        id: gps51Vehicle.id,
        license_plate: gps51Vehicle.plate,
        brand: 'GPS51',
        model: gps51Vehicle.name,
        type: mapVehicleType(gps51Vehicle.type),
        status: mapVehicleStatus(gps51Vehicle.status),
        updated_at: new Date().toISOString(),
      };

      const { error: vehicleError } = await supabase
        .from('vehicles')
        .upsert(vehicleData, { onConflict: 'id' });

      if (vehicleError) {
        console.error(`Error syncing vehicle ${gps51Vehicle.id}:`, vehicleError);
        continue;
      }
    }

    // Fetch latest positions from GPS51
    console.log('Fetching latest positions from GPS51...');
    const positionsResponse = await fetch(`${gps51Config.baseUrl}/positions/latest`, {
      headers: {
        'Authorization': `Bearer ${gps51Config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!positionsResponse.ok) {
      throw new Error(`GPS51 positions API error: ${positionsResponse.status}`);
    }

    const gps51Positions: GPS51Position[] = await positionsResponse.json();
    console.log(`Found ${gps51Positions.length} position updates`);

    // Store positions (we'll create this table in the SQL migration)
    const positionData = gps51Positions.map(pos => ({
      vehicle_id: pos.vehicleId,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      heading: pos.heading,
      timestamp: new Date(pos.timestamp).toISOString(),
      ignition_status: pos.ignition,
      fuel_level: pos.fuel,
      engine_temperature: pos.temperature,
      recorded_at: new Date().toISOString(),
    }));

    if (positionData.length > 0) {
      const { error: positionError } = await supabase
        .from('vehicle_positions')
        .insert(positionData);

      if (positionError) {
        console.error('Error storing positions:', positionError);
      }
    }

    console.log('GPS51 sync completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        vehiclesSynced: gps51Vehicles.length,
        positionsStored: gps51Positions.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('GPS51 sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function mapVehicleType(gps51Type: string): string {
  const typeMap: Record<string, string> = {
    'car': 'sedan',
    'truck': 'truck',
    'van': 'van',
    'motorcycle': 'motorcycle',
  };
  return typeMap[gps51Type] || 'other';
}

function mapVehicleStatus(gps51Status: string): string {
  const statusMap: Record<string, string> = {
    'active': 'available',
    'inactive': 'unavailable',
    'maintenance': 'maintenance',
  };
  return statusMap[gps51Status] || 'unavailable';
}
