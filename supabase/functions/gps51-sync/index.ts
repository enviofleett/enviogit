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
      console.log('Request body received:', {
        length: requestText.length,
        preview: requestText.substring(0, 200) + (requestText.length > 200 ? '...' : '')
      });
      
      if (!requestText || requestText.trim() === '') {
        throw new Error('Empty request body received');
      }

      requestBody = JSON.parse(requestText);
      console.log("GPS51 Sync Request Debug:", {
        hasUsername: !!requestBody.username,
        hasPassword: !!requestBody.password,
        hasApiUrl: !!requestBody.apiUrl,
        passwordLength: requestBody.password?.length || 0,
        apiUrl: requestBody.apiUrl
      });
    } catch (e) {
      console.error("Error parsing request body:", e);
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
    
    // Ensure we use the correct GPS51 API URL
    let correctedApiUrl = apiUrl.replace(/\/$/, '');
    if (correctedApiUrl.includes('www.gps51.com')) {
      console.log('Correcting API URL from www.gps51.com to api.gps51.com');
      correctedApiUrl = correctedApiUrl.replace('www.gps51.com', 'api.gps51.com');
    }

    // Generate a proper random token for the login request
    const generateToken = () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    // Step 1: Authenticate with GPS51 API using POST request with JSON body
    const loginToken = generateToken();
    const loginUrl = new URL(correctedApiUrl);
    loginUrl.searchParams.append('action', 'login');
    loginUrl.searchParams.append('token', loginToken);

    const loginPayload = {
      username: username,
      password: password, // Should already be MD5 hashed from client
      from: 'WEB',
      type: 'USER'
    };

    console.log("GPS51 Login Request Debug:", {
      url: loginUrl.toString(),
      method: 'POST',
      payload: {
        username: loginPayload.username,
        passwordLength: loginPayload.password.length,
        isValidMD5: /^[a-f0-9]{32}$/.test(loginPayload.password),
        from: loginPayload.from,
        type: loginPayload.type
      },
      correctedApiUrl
    });

    console.log("Sending GPS51 login request with POST method and JSON body...");
    const loginResponse = await fetch(loginUrl.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload)
    });

    const loginResponseText = await loginResponse.text();
    console.log(`GPS51 Login Response Debug:`, {
      status: loginResponse.status,
      statusText: loginResponse.statusText,
      contentType: loginResponse.headers.get('content-type'),
      contentLength: loginResponse.headers.get('content-length'),
      bodyLength: loginResponseText.length,
      bodyPreview: loginResponseText.substring(0, 500),
      isJSON: loginResponseText.trim().startsWith('{') || loginResponseText.trim().startsWith('[')
    });

    if (!loginResponse.ok) {
      throw new Error(`GPS51 login HTTP error: ${loginResponse.status} ${loginResponse.statusText} - ${loginResponseText}`);
    }

    let loginData: GPS51ApiResponse;
    try {
      loginData = JSON.parse(loginResponseText);
      console.log('GPS51 Login Parsed Response:', {
        status: loginData.status,
        message: loginData.message,
        hasToken: !!loginData.token,
        tokenLength: loginData.token?.length || 0
      });
    } catch (parseError) {
      console.error('Failed to parse GPS51 login response as JSON:', {
        error: parseError.message,
        responseText: loginResponseText
      });
      throw new Error(`Failed to parse login response: ${loginResponseText}`);
    }

    if (loginData.status !== 0 || !loginData.token) {
      const errorDetails = {
        status: loginData.status,
        message: loginData.message,
        hasToken: !!loginData.token,
        fullResponse: loginData
      };
      console.error('GPS51 login failed:', errorDetails);
      
      let errorMessage = loginData.message || `Login failed with status: ${loginData.status}`;
      if (loginData.status === 8901) {
        errorMessage += ' (Status 8901: Authentication parameter validation failed - check username, password hash, from, and type parameters)';
      } else if (loginData.status === 1) {
        errorMessage += ' (Status 1: Login failed - verify credentials and account status)';
      }
      
      throw new Error(errorMessage);
    }

    const token = loginData.token;
    console.log('GPS51 login successful, token received');

    // Step 2: Fetch device list using query parameters
    const deviceListUrl = new URL(correctedApiUrl);
    deviceListUrl.searchParams.append('action', 'querymonitorlist');
    deviceListUrl.searchParams.append('token', token);

    console.log("Fetching device list...");
    const deviceResponse = await fetch(deviceListUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
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

    // Step 3: Fetch positions for devices using query parameters
    let positions: GPS51Position[] = [];
    if (devices.length > 0) {
      const deviceIds = devices.map(d => d.deviceid).join(',');
      const positionUrl = new URL(correctedApiUrl);
      positionUrl.searchParams.append('action', 'lastposition');
      positionUrl.searchParams.append('token', token);
      positionUrl.searchParams.append('deviceids', deviceIds);

      console.log("Fetching positions...");
      const positionResponse = await fetch(positionUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
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
    console.error('GPS51 sync error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
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
