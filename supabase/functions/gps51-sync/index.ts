
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
  groups?: any[];
  records?: any[];
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

    // Step 2: Fetch device list using POST with username parameter
    const deviceListUrl = new URL(correctedApiUrl);
    deviceListUrl.searchParams.append('action', 'querymonitorlist');
    deviceListUrl.searchParams.append('token', token);

    console.log("Fetching device list...");
    const deviceResponse = await fetch(deviceListUrl.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: username })
    });

    const deviceResponseText = await deviceResponse.text();
    console.log(`Device List Response: ${deviceResponse.status} - ${deviceResponseText.substring(0, 1000)}...`);

    let devices: GPS51Device[] = [];
    let deviceIds: string[] = [];
    
    if (deviceResponse.ok && deviceResponseText.trim()) {
      try {
        const deviceData = JSON.parse(deviceResponseText);
        console.log('Device Data Structure:', {
          status: deviceData.status,
          hasGroups: !!deviceData.groups,
          groupsLength: deviceData.groups?.length || 0
        });
        
        if (deviceData.status === 0 && deviceData.groups) {
          // Process groups format
          deviceData.groups.forEach((group: any) => {
            console.log(`Processing group: ${group.groupname}, devices: ${group.devices?.length || 0}`);
            if (group.devices && Array.isArray(group.devices)) {
              devices = devices.concat(group.devices);
              group.devices.forEach((device: GPS51Device) => {
                deviceIds.push(device.deviceid);
              });
            }
          });
        }
      } catch (e) {
        console.warn('Failed to parse device response, continuing with empty array:', e);
      }
    }

    console.log(`Found ${devices.length} devices, device IDs: ${deviceIds.join(', ')}`);

    // Step 3: Fetch positions for devices using POST with deviceids parameter
    let positions: GPS51Position[] = [];
    if (deviceIds.length > 0) {
      const positionUrl = new URL(correctedApiUrl);
      positionUrl.searchParams.append('action', 'lastposition');
      positionUrl.searchParams.append('token', token);

      const positionPayload = {
        deviceids: deviceIds,
        lastquerypositiontime: 0
      };

      console.log("Fetching positions with payload:", positionPayload);
      const positionResponse = await fetch(positionUrl.toString(), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(positionPayload)
      });

      const positionResponseText = await positionResponse.text();
      console.log(`Position Response: ${positionResponse.status} - ${positionResponseText}`);

      if (positionResponse.ok && positionResponseText.trim() && positionResponseText !== 'null') {
        try {
          const positionData = JSON.parse(positionResponseText);
          console.log('Position Data Structure:', {
            status: positionData.status,
            hasRecords: !!positionData.records,
            hasData: !!positionData.data,
            recordsLength: positionData.records?.length || 0,
            dataLength: positionData.data?.length || 0
          });
          
          if (positionData.status === 0) {
            // Handle different response formats
            if (positionData.records && Array.isArray(positionData.records)) {
              positions = positionData.records;
            } else if (positionData.data && Array.isArray(positionData.data)) {
              positions = positionData.data;
            }
          }
        } catch (e) {
          console.warn('Failed to parse position response, continuing with empty array:', e);
        }
      } else {
        console.log('No position data available or null response received');
      }
    }

    console.log(`Found ${positions.length} positions`);

    // Step 4: Sync vehicles to database with GPS51 device IDs
    let vehiclesSynced = 0;
    const deviceToVehicleMap = new Map<string, string>(); // deviceid -> vehicle_id mapping
    
    for (const device of devices) {
      try {
        const vehicleData = {
          license_plate: device.devicename,
          gps51_device_id: device.deviceid, // Store GPS51 device ID for position mapping
          brand: 'GPS51',
          model: `Device ${device.devicetype}`,
          type: mapDeviceTypeToVehicleType(device.devicetype),
          status: (device.isfree === 1 ? 'available' : 'assigned') as 'available' | 'inactive' | 'maintenance' | 'assigned',
          notes: `Device ID: ${device.deviceid}, SIM: ${device.simnum}`,
          updated_at: new Date().toISOString(),
        };

        console.log(`Syncing vehicle: ${device.devicename} with GPS51 ID: ${device.deviceid}`);

        const { data: vehicleResult, error: vehicleError } = await supabase
          .from('vehicles')
          .upsert(vehicleData, { onConflict: 'license_plate' })
          .select('id')
          .single();

        if (!vehicleError && vehicleResult) {
          vehiclesSynced++;
          deviceToVehicleMap.set(device.deviceid, vehicleResult.id);
          console.log(`Successfully synced vehicle ${device.devicename} -> ${vehicleResult.id}`);
        } else {
          console.warn(`Error syncing vehicle ${device.deviceid}:`, vehicleError);
        }
      } catch (err) {
        console.warn(`Error processing vehicle ${device.deviceid}:`, err);
      }
    }

    console.log(`Vehicle sync completed: ${vehiclesSynced} vehicles synced`);
    console.log('Device to Vehicle mapping:', Array.from(deviceToVehicleMap.entries()));

    // Step 5: Store positions using GPS51 device ID mapping
    let positionsStored = 0;
    for (const position of positions) {
      try {
        console.log(`Processing position for GPS51 device: ${position.deviceid}`);

        // Find vehicle by GPS51 device ID
        const { data: vehicle, error: vehicleQueryError } = await supabase
          .from('vehicles')
          .select('id')
          .eq('gps51_device_id', position.deviceid)
          .single();

        if (vehicleQueryError) {
          console.warn(`Error finding vehicle for device ${position.deviceid}:`, vehicleQueryError);
          continue;
        }

        if (vehicle) {
          const positionData = {
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
          };

          console.log(`Storing position for vehicle ${vehicle.id}:`, {
            deviceId: position.deviceid,
            lat: position.callat,
            lon: position.callon,
            speed: position.speed,
            moving: position.moving
          });

          const { error: positionError } = await supabase
            .from('vehicle_positions')
            .insert(positionData);

          if (!positionError) {
            positionsStored++;
            console.log(`Successfully stored position for device ${position.deviceid}`);
          } else {
            console.warn(`Failed to store position for device ${position.deviceid}:`, positionError);
          }
        } else {
          console.warn(`No vehicle found for GPS51 device ID: ${position.deviceid}`);
        }
      } catch (err) {
        console.warn(`Error storing position for ${position.deviceid}:`, err);
      }
    }

    console.log(`Position storage completed: ${positionsStored} positions stored`);
    console.log('GPS51 sync completed successfully');
    
    return new Response(
      JSON.stringify({
        success: true,
        vehiclesSynced,
        positionsStored,
        devicesFound: devices.length,
        positionsFound: positions.length,
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
