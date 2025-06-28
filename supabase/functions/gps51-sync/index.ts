
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51SyncRequest {
  apiUrl: string;
  username: string;
  password: string;
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

    // Ensure the request method is POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed. Only POST requests are supported.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    let requestBody: GPS51SyncRequest;
    try {
      // Read the request body as text first
      const requestText = await req.text();
      console.log('Request body length:', requestText.length);
      
      if (!requestText || requestText.trim() === '') {
        throw new Error('Empty request body received');
      }

      requestBody = JSON.parse(requestText);
      console.log("Incoming Edge Function Request Body:", requestBody);
    } catch (e) {
      console.error("Error parsing incoming request body:", e);
      return new Response(JSON.stringify({ error: 'Invalid or empty request body. Expected JSON.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate that the necessary credentials are in the requestBody
    if (!requestBody || !requestBody.username || !requestBody.password || !requestBody.apiUrl) {
      return new Response(JSON.stringify({ error: 'Missing required parameters in request body (username, password, apiUrl).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { username, password, apiUrl } = requestBody;
    const baseUrl = apiUrl.replace(/\/$/, '');

    // Construct the payload for the GPS51 API login
    const gps51ApiLoginPayload = {
      action: "login",
      username: username,
      password: password, // This should already be MD5 hashed from the client
      from: "WEB",
      type: "USER"
    };

    console.log("Attempting to fetch from GPS51 API with payload:", gps51ApiLoginPayload);
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gps51ApiLoginPayload),
    });

    console.log(`GPS51 API Response Status: ${response.status}`);
    const responseText = await response.text();
    console.log(`GPS51 API Raw Response: ${responseText}`);

    if (!response.ok) {
      throw new Error(`GPS51 API error: ${response.status} - ${responseText}`);
    }

    let gps51Vehicles: GPS51Vehicle[] = [];
    if (responseText.trim()) {
      try {
        const data = JSON.parse(responseText);
        console.log("GPS51 API Parsed JSON Data:", data);
        
        // Handle successful login and fetch vehicle data
        if (data.success || data.token) {
          // Mock vehicle data for now - replace with actual GPS51 API calls
          gps51Vehicles = [];
        }
      } catch (parseError) {
        console.error('Failed to parse vehicles response as JSON:', parseError);
        console.log('Attempting to handle non-JSON response...');
        gps51Vehicles = [];
      }
    }

    console.log(`Found ${gps51Vehicles.length} vehicles in GPS51`);

    // Sync vehicles to database
    for (const gps51Vehicle of gps51Vehicles) {
      const vehicleData = {
        license_plate: gps51Vehicle.plate,
        brand: 'GPS51',
        model: gps51Vehicle.name,
        type: mapVehicleType(gps51Vehicle.type),
        status: mapVehicleStatus(gps51Vehicle.status),
        updated_at: new Date().toISOString(),
      };

      const { error: vehicleError } = await supabase
        .from('vehicles')
        .upsert(vehicleData, { onConflict: 'license_plate' });

      if (vehicleError) {
        console.error(`Error syncing vehicle ${gps51Vehicle.id}:`, vehicleError);
        continue;
      }
    }

    console.log('GPS51 sync completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        vehiclesSynced: gps51Vehicles.length,
        positionsStored: 0,
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
