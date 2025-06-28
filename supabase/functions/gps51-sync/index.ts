
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51SyncRequest {
  apiUrl: string;
  accessToken: string;
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

    // Accept configuration from request body
    const requestBody = await req.text();
    console.log('Request body length:', requestBody.length);
    
    if (!requestBody) {
      throw new Error('Empty request body received');
    }

    const { apiUrl, accessToken }: GPS51SyncRequest = JSON.parse(requestBody);

    if (!apiUrl || !accessToken) {
      throw new Error('Missing required parameters: apiUrl and accessToken are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const baseUrl = apiUrl.replace(/\/$/, '');

    // Fetch vehicles from GPS51
    console.log('Fetching vehicles from GPS51...');
    const vehiclesResponse = await fetch(`${baseUrl}/v1/vehicles`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Vehicles API Response Status: ${vehiclesResponse.status}`);
    const vehiclesResponseText = await vehiclesResponse.text();
    console.log(`Vehicles API Raw Response: ${vehiclesResponseText}`);

    if (!vehiclesResponse.ok) {
      throw new Error(`GPS51 API error: ${vehiclesResponse.status} - ${vehiclesResponseText}`);
    }

    let gps51Vehicles: GPS51Vehicle[] = [];
    if (vehiclesResponseText.trim()) {
      try {
        gps51Vehicles = JSON.parse(vehiclesResponseText);
      } catch (parseError) {
        console.error('Failed to parse vehicles response as JSON:', parseError);
        console.log('Attempting to handle non-JSON response...');
        // Handle case where API returns success but not JSON
        gps51Vehicles = [];
      }
    }

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
    const positionsResponse = await fetch(`${baseUrl}/v1/positions/latest`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Positions API Response Status: ${positionsResponse.status}`);
    const positionsResponseText = await positionsResponse.text();
    console.log(`Positions API Raw Response: ${positionsResponseText}`);

    if (!positionsResponse.ok) {
      console.warn(`GPS51 positions API returned ${positionsResponse.status}, continuing without positions`);
    }

    let gps51Positions: GPS51Position[] = [];
    if (positionsResponse.ok && positionsResponseText.trim()) {
      try {
        gps51Positions = JSON.parse(positionsResponseText);
      } catch (parseError) {
        console.error('Failed to parse positions response as JSON:', parseError);
        gps51Positions = [];
      }
    }

    console.log(`Found ${gps51Positions.length} position updates`);

    // Store positions in the vehicle_positions table
    if (gps51Positions.length > 0) {
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
      }));

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
    'motorcycle': 'bike',
  };
  return typeMap[gps51Type] || 'sedan';
}

function mapVehicleStatus(gps51Status: string): string {
  const statusMap: Record<string, string> = {
    'active': 'available',
    'inactive': 'inactive',
    'maintenance': 'maintenance',
  };
  return statusMap[gps51Status] || 'inactive';
}
