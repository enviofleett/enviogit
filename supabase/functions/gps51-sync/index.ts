
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

interface GPS51ApiResponse {
  status: number;
  message?: string;
  data?: any;
  token?: string;
}

interface GPS51Device {
  deviceid: string;
  devicename: string;
  devicetype: number;
  simnum: string;
  lastactivetime: number;
  isfree: number;
  allowedit: number;
  icon: number;
}

interface GPS51Position {
  deviceid: string;
  callat: number;
  callon: number;
  updatetime: number;
  speed: number;
  course: number;
  moving: number;
  strstatus: string;
  temp1?: number;
  voltagepercent?: number;
  status: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting GPS51 sync process...');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed. Only POST requests are supported.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    let requestBody: GPS51SyncRequest;
    try {
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

    // Step 1: Authenticate with GPS51 API
    const loginPayload = {
      action: "login",
      username: username,
      password: password,
      from: "WEB",
      type: "USER"
    };

    console.log("Attempting GPS51 login...");
    const loginResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload),
    });

    const loginResponseText = await loginResponse.text();
    console.log(`GPS51 Login Response: ${loginResponse.status} - ${loginResponseText}`);

    if (!loginResponse.ok) {
      throw new Error(`GPS51 login failed: ${loginResponse.status} - ${loginResponseText}`);
    }

    let loginData: GPS51ApiResponse;
    try {
      loginData = JSON.parse(loginResponseText);
    } catch (e) {
      throw new Error(`Failed to parse login response: ${loginResponseText}`);
    }

    if (loginData.status !== 0 || !loginData.token) {
      throw new Error(`GPS51 login failed: ${loginData.message || 'No token received'}`);
    }

    const token = loginData.token;
    console.log('GPS51 login successful, token received');

    // Step 2: Fetch device list
    const deviceListPayload = {
      action: "querymonitorlist",
      token: token
    };

    console.log("Fetching device list...");
    const deviceResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deviceListPayload),
    });

    const deviceResponseText = await deviceResponse.text();
    console.log(`Device List Response: ${deviceResponse.status} - ${deviceResponseText}`);

    let devices: GPS51Device[] = [];
    if (deviceResponse.ok && deviceResponseText.trim()) {
      try {
        const deviceData = JSON.parse(deviceResponseText);
        if (deviceData.status === 0 && deviceData.data) {
          devices = Array.isArray(deviceData.data) ? deviceData.data : [];
        }
      } catch (e) {
        console.warn('Failed to parse device response, continuing with empty array');
      }
    }

    console.log(`Found ${devices.length} devices`);

    // Step 3: Fetch positions for devices
    let positions: GPS51Position[] = [];
    if (devices.length > 0) {
      const deviceIds = devices.map(d => d.deviceid).join(',');
      const positionPayload = {
        action: "lastposition",
        token: token,
        deviceids: deviceIds
      };

      console.log("Fetching positions...");
      const positionResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(positionPayload),
      });

      const positionResponseText = await positionResponse.text();
      console.log(`Position Response: ${positionResponse.status} - ${positionResponseText}`);

      if (positionResponse.ok && positionResponseText.trim()) {
        try {
          const positionData = JSON.parse(positionResponseText);
          if (positionData.status === 0 && positionData.data) {
            positions = Array.isArray(positionData.data) ? positionData.data : [];
          }
        } catch (e) {
          console.warn('Failed to parse position response, continuing with empty array');
        }
      }
    }

    console.log(`Found ${positions.length} positions`);

    // Step 4: Sync vehicles to database
    let vehiclesSynced = 0;
    for (const device of devices) {
      try {
        const vehicleData = {
          license_plate: device.devicename,
          brand: 'GPS51',
          model: `Device ${device.devicetype}`,
          type: mapDeviceTypeToVehicleType(device.devicetype),
          status: device.isfree === 1 ? 'available' : 'assigned',
          notes: `Device ID: ${device.deviceid}, SIM: ${device.simnum}`,
          updated_at: new Date().toISOString(),
        };

        const { error: vehicleError } = await supabase
          .from('vehicles')
          .upsert(vehicleData, { onConflict: 'license_plate' });

        if (!vehicleError) {
          vehiclesSynced++;
        } else {
          console.warn(`Error syncing vehicle ${device.deviceid}:`, vehicleError);
        }
      } catch (err) {
        console.warn(`Error processing vehicle ${device.deviceid}:`, err);
      }
    }

    // Step 5: Store positions
    let positionsStored = 0;
    for (const position of positions) {
      try {
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('id')
          .eq('license_plate', position.deviceid)
          .single();

        if (vehicle) {
          const { error: positionError } = await supabase
            .from('vehicle_positions')
            .insert({
              vehicle_id: vehicle.id,
              latitude: position.callat,
              longitude: position.callon,
              speed: position.speed,
              heading: position.course,
              timestamp: new Date(position.updatetime).toISOString(),
              ignition_status: position.moving === 1,
              fuel_level: position.voltagepercent,
              engine_temperature: position.temp1,
              address: position.strstatus,
              recorded_at: new Date().toISOString()
            });

          if (!positionError) {
            positionsStored++;
          }
        }
      } catch (err) {
        console.warn(`Error storing position for ${position.deviceid}:`, err);
      }
    }

    console.log('GPS51 sync completed successfully');
    return new Response(
      JSON.stringify({
        success: true,
        vehiclesSynced,
        positionsStored,
        devicesFound: devices.length,
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

function mapDeviceTypeToVehicleType(deviceType: number): 'sedan' | 'truck' | 'van' | 'motorcycle' | 'bike' | 'other' {
  switch (deviceType) {
    case 1:
    case 2:
      return 'sedan';
    case 3:
    case 4:
      return 'truck';
    case 5:
      return 'van';
    case 6:
      return 'motorcycle';
    case 7:
      return 'bike';
    default:
      return 'other';
  }
}
