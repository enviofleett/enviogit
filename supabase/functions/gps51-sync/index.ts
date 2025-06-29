
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51SyncRequest {
  apiUrl?: string;
  username?: string;
  password?: string;
  priority?: number;
  batchMode?: boolean;
  cronTriggered?: boolean;
}

interface GPS51ApiResponse {
  status: number;
  message?: string;
  data?: any;
  token?: string;
  groups?: any[];
  records?: any[];
  user?: any;
  lastquerypositiontime?: number;
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
  devicetime: number;
  callat: number;
  callon: number;
  altitude: number;
  speed: number;
  course: number;
  totaldistance: number;
  status: number;
  moving: number;
  strstatus: string;
  updatetime: number;
  temp1?: number;
  temp2?: number;
  voltage?: number;
  fuel?: number;
  radius?: number;
  voltagepercent?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let authenticatedToken: string | null = null;

  try {
    console.log('=== GPS51 SYNC STARTED (ENHANCED WITH DEBUG) ===');
    console.log('Timestamp:', new Date().toISOString());

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed. Only POST requests are supported.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    let requestBody: GPS51SyncRequest = {};
    try {
      const requestText = await req.text();
      console.log('Request received:', {
        bodyLength: requestText.length,
        hasContent: !!requestText.trim()
      });
      
      if (requestText && requestText.trim() !== '') {
        requestBody = JSON.parse(requestText);
      }
    } catch (e) {
      console.error("Request parsing error:", e);
    }

    console.log("GPS51 Sync Request validation:", {
      hasUsername: !!requestBody.username,
      hasPassword: !!requestBody.password,
      hasApiUrl: !!requestBody.apiUrl,
      passwordLength: requestBody.password?.length || 0,
      priority: requestBody.priority,
      batchMode: requestBody.batchMode,
      cronTriggered: requestBody.cronTriggered || false
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get credentials from request body or environment variables
    let finalApiUrl = requestBody.apiUrl || Deno.env.get('GPS51_API_URL');
    let finalUsername = requestBody.username || Deno.env.get('GPS51_USERNAME');
    let finalPassword = requestBody.password || Deno.env.get('GPS51_PASSWORD_MD5');

    // Also try localStorage-style environment variables
    if (!finalApiUrl) finalApiUrl = Deno.env.get('gps51_api_url');
    if (!finalUsername) finalUsername = Deno.env.get('gps51_username');
    if (!finalPassword) finalPassword = Deno.env.get('gps51_password_hash');

    console.log('Credential sources:', {
      apiUrl: finalApiUrl ? 'available' : 'missing',
      username: finalUsername ? 'available' : 'missing',
      password: finalPassword ? 'available' : 'missing',
      fromEnv: {
        GPS51_API_URL: !!Deno.env.get('GPS51_API_URL'),
        GPS51_USERNAME: !!Deno.env.get('GPS51_USERNAME'),
        GPS51_PASSWORD_MD5: !!Deno.env.get('GPS51_PASSWORD_MD5')
      }
    });

    if (!finalApiUrl || !finalUsername || !finalPassword) {
      const missingCredentials = [];
      if (!finalApiUrl) missingCredentials.push('apiUrl/GPS51_API_URL');
      if (!finalUsername) missingCredentials.push('username/GPS51_USERNAME');
      if (!finalPassword) missingCredentials.push('password/GPS51_PASSWORD_MD5');
      
      throw new Error(`GPS51 credentials not available for automated sync. Missing: ${missingCredentials.join(', ')}. Please configure Supabase secrets or pass credentials in request body.`);
    }
    
    // Ensure we use the correct GPS51 API URL
    let correctedApiUrl = finalApiUrl.replace(/\/$/, '');
    if (correctedApiUrl.includes('www.gps51.com')) {
      console.log('Correcting API URL from www.gps51.com to api.gps51.com');
      correctedApiUrl = correctedApiUrl.replace('www.gps51.com', 'api.gps51.com');
    }
    if (correctedApiUrl.includes('/webapi')) {
      console.log('Migrating API URL from /webapi to /openapi');
      correctedApiUrl = correctedApiUrl.replace('/webapi', '/openapi');
    }

    console.log('Using corrected API URL:', correctedApiUrl);

    // Generate a proper random token for the login request
    const generateToken = () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    // Step 1: Authenticate with GPS51 API
    const loginToken = generateToken();
    const loginUrl = `${correctedApiUrl}?action=login&token=${loginToken}`;

    const loginPayload = {
      username: finalUsername,
      password: finalPassword,
      from: 'WEB',
      type: 'USER'
    };

    console.log("=== GPS51 LOGIN ATTEMPT ===");
    console.log("Login URL:", loginUrl);
    console.log("Login payload:", {
      username: loginPayload.username,
      passwordLength: loginPayload.password.length,
      from: loginPayload.from,
      type: loginPayload.type
    });

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload)
    });

    const loginResponseText = await loginResponse.text();
    console.log(`GPS51 Login Response:`, {
      status: loginResponse.status,
      statusText: loginResponse.statusText,
      contentType: loginResponse.headers.get('Content-Type'),
      bodyLength: loginResponseText.length,
      bodyPreview: loginResponseText.substring(0, 200)
    });

    console.log(`GPS51 Login Raw Response Body: ${loginResponseText}`);

    if (!loginResponse.ok) {
      throw new Error(`GPS51 login HTTP error: ${loginResponse.status} ${loginResponse.statusText} - ${loginResponseText}`);
    }

    let loginData: GPS51ApiResponse;
    try {
      loginData = JSON.parse(loginResponseText);
      console.log('GPS51 Login Success:', {
        status: loginData.status,
        message: loginData.message,
        hasToken: !!loginData.token,
        tokenLength: loginData.token?.length || 0
      });
    } catch (parseError) {
      console.error('Failed to parse GPS51 login response:', parseError);
      throw new Error(`Failed to parse login response: ${loginResponseText}`);
    }

    if (loginData.status !== 0 || !loginData.token) {
      const errorMsg = loginData.message || `Login failed with status: ${loginData.status}`;
      console.error('GPS51 login failed:', { status: loginData.status, message: loginData.message });
      throw new Error(errorMsg);
    }

    // Store the authenticated token for subsequent requests
    authenticatedToken = loginData.token;
    console.log('GPS51 login successful, authenticated token acquired:', authenticatedToken.substring(0, 8) + '...');

    // Step 2: Get device list using the authenticated token
    const deviceListToken = generateToken();
    const deviceListUrl = `${correctedApiUrl}?action=querymonitorlist&token=${deviceListToken}`;

    const deviceListPayload = {
      username: finalUsername,
      token: authenticatedToken // Include the authenticated token in the payload
    };

    console.log("=== GPS51 DEVICE LIST REQUEST ===");
    console.log("Device List URL:", deviceListUrl);
    console.log("Device List Payload:", {
      username: deviceListPayload.username,
      hasAuthToken: !!deviceListPayload.token,
      authTokenPreview: deviceListPayload.token?.substring(0, 8) + '...'
    });
    
    const deviceListResponse = await fetch(deviceListUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
        // Note: Removed Authorization header - GPS51 uses token in URL and payload
      },
      body: JSON.stringify(deviceListPayload)
    });

    const deviceListResponseText = await deviceListResponse.text();
    console.log(`GPS51 Device List Response:`, {
      status: deviceListResponse.status,
      statusText: deviceListResponse.statusText,
      contentType: deviceListResponse.headers.get('Content-Type'),
      bodyLength: deviceListResponseText.length
    });

    console.log(`GPS51 Device List Raw Response Body: ${deviceListResponseText}`);

    let devices: GPS51Device[] = [];
    if (deviceListResponse.ok) {
      try {
        const deviceListData: GPS51ApiResponse = JSON.parse(deviceListResponseText);
        console.log('Device list data:', {
          status: deviceListData.status,
          message: deviceListData.message,
          hasGroups: !!deviceListData.groups,
          groupsLength: deviceListData.groups?.length || 0,
          hasData: !!deviceListData.data,
          dataType: Array.isArray(deviceListData.data) ? 'array' : typeof deviceListData.data
        });

        if (deviceListData.status === 0 && deviceListData.groups) {
          deviceListData.groups.forEach((group: any) => {
            console.log(`Processing group:`, {
              groupId: group.groupid,
              groupName: group.groupname,
              hasDevices: !!group.devices,
              deviceCount: group.devices?.length || 0
            });
            
            if (group.devices && Array.isArray(group.devices)) {
              devices = devices.concat(group.devices);
            }
          });
          console.log(`Found ${devices.length} devices total`);
        } else {
          console.warn('Unexpected device list response format or error:', {
            status: deviceListData.status,
            message: deviceListData.message,
            responseKeys: Object.keys(deviceListData)
          });
        }
      } catch (e) {
        console.error('Failed to parse device list response:', e);
        console.error('Raw response that failed to parse:', deviceListResponseText);
      }
    } else {
      console.error('Device list request failed with HTTP error:', {
        status: deviceListResponse.status,
        statusText: deviceListResponse.statusText,
        body: deviceListResponseText
      });
    }

    // Step 3: Get last query position time from database
    const { data: lastSyncData } = await supabase
      .from('gps51_sync_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    let lastQueryPositionTime = 0;
    if (lastSyncData && lastSyncData.execution_time_seconds) {
      // Use timestamp from last successful sync
      lastQueryPositionTime = new Date(lastSyncData.started_at).getTime();
    }

    // Step 4: Get real-time positions if we have devices
    let positions: GPS51Position[] = [];
    if (devices.length > 0) {
      const positionToken = generateToken();
      const positionUrl = `${correctedApiUrl}?action=lastposition&token=${positionToken}`;

      const deviceIds = devices.map(d => d.deviceid);
      const positionPayload = {
        deviceids: deviceIds,
        lastquerypositiontime: lastQueryPositionTime,
        token: authenticatedToken // Include the authenticated token
      };

      console.log("=== GPS51 POSITION REQUEST ===");
      console.log(`Requesting positions for ${deviceIds.length} devices with lastquerypositiontime: ${lastQueryPositionTime}`);
      console.log("Position URL:", positionUrl);
      console.log("Position Payload:", {
        deviceidsCount: positionPayload.deviceids.length,
        lastQueryTime: positionPayload.lastquerypositiontime,
        hasAuthToken: !!positionPayload.token
      });

      const positionResponse = await fetch(positionUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
          // Note: Removed Authorization header - GPS51 uses token in URL and payload
        },
        body: JSON.stringify(positionPayload)
      });

      const positionResponseText = await positionResponse.text();
      console.log(`GPS51 Position Response:`, {
        status: positionResponse.status,
        statusText: positionResponse.statusText,
        contentType: positionResponse.headers.get('Content-Type'),
        bodyLength: positionResponseText.length
      });

      console.log(`GPS51 Position Raw Response Body: ${positionResponseText}`);

      if (positionResponse.ok) {
        try {
          const positionData: GPS51ApiResponse = JSON.parse(positionResponseText);
          console.log('Position data:', {
            status: positionData.status,
            message: positionData.message,
            hasRecords: !!positionData.records,
            recordsLength: positionData.records?.length || 0,
            lastQueryPositionTime: positionData.lastquerypositiontime
          });
          
          if (positionData.status === 0 && positionData.records) {
            positions = positionData.records;
            console.log(`Retrieved ${positions.length} positions`);
            
            // Update last query position time for next sync
            if (positionData.lastquerypositiontime) {
              lastQueryPositionTime = positionData.lastquerypositiontime;
            }
          } else {
            console.warn('Unexpected position response format or error:', {
              status: positionData.status,
              message: positionData.message,
              responseKeys: Object.keys(positionData)
            });
          }
        } catch (e) {
          console.error('Failed to parse position response:', e);
          console.error('Raw position response that failed to parse:', positionResponseText);
        }
      } else {
        console.error('Position request failed with HTTP error:', {
          status: positionResponse.status,
          statusText: positionResponse.statusText,
          body: positionResponseText
        });
      }
    }

    // Step 5: Store data in Supabase
    let vehiclesSynced = 0;
    let positionsStored = 0;

    // Create sync job record
    const { data: syncJob } = await supabase
      .from('gps51_sync_jobs')
      .insert({
        priority: requestBody.priority || 2,
        vehicles_processed: devices.length,
        positions_stored: 0,
        success: false
      })
      .select()
      .single();

    if (devices.length > 0) {
      // Update or insert vehicles
      for (const device of devices) {
        try {
          const { error: vehicleError } = await supabase
            .from('vehicles')
            .upsert({
              gps51_device_id: device.deviceid,
              license_plate: device.devicename || device.deviceid,
              brand: 'GPS51',
              model: 'Device ' + (device.devicetype || '92'),
              type: 'other' as const,
              status: device.isfree === 1 ? 'available' as const : 'assigned' as const,
              notes: `Device ID: ${device.deviceid}, SIM: ${device.simnum || 'Unknown'}`,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'gps51_device_id'
            });

          if (!vehicleError) {
            vehiclesSynced++;
          } else {
            console.error('Vehicle upsert error:', vehicleError);
          }
        } catch (e) {
          console.error('Vehicle processing error:', e);
        }
      }
    }

    if (positions.length > 0) {
      // Store positions
      for (const position of positions) {
        try {
          // Find the vehicle by GPS51 device ID
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('id')
            .eq('gps51_device_id', position.deviceid)
            .single();

          if (vehicle) {
            const { error: positionError } = await supabase
              .from('vehicle_positions')
              .upsert({
                vehicle_id: vehicle.id,
                latitude: position.callat,
                longitude: position.callon,
                speed: position.speed,
                heading: position.course,
                altitude: position.altitude,
                accuracy: position.radius,
                timestamp: new Date(position.updatetime).toISOString(),
                address: position.strstatus || 'Unknown',
                ignition_status: position.moving === 1,
                fuel_level: position.voltagepercent,
                engine_temperature: position.temp1 ? position.temp1 / 10 : null,
                battery_level: position.voltage,
                recorded_at: new Date().toISOString()
              }, {
                onConflict: 'vehicle_id,timestamp'
              });

            if (!positionError) {
              positionsStored++;
            } else {
              console.error('Position upsert error:', positionError);
            }
          }
        } catch (e) {
          console.error('Position processing error:', e);
        }
      }
    }

    // Update sync job with results
    if (syncJob) {
      await supabase
        .from('gps51_sync_jobs')
        .update({
          completed_at: new Date().toISOString(),
          success: true,
          vehicles_processed: vehiclesSynced,
          positions_stored: positionsStored,
          execution_time_seconds: Math.round((Date.now() - startTime) / 1000)
        })
        .eq('id', syncJob.id);
    }

    // Return success response
    const executionTime = (Date.now() - startTime) / 1000;
    const result = {
      success: true,
      message: 'GPS51 sync completed successfully',
      timestamp: new Date().toISOString(),
      executionTimeSeconds: executionTime,
      vehiclesSynced,
      positionsStored,
      devicesFound: devices.length,
      positionsRetrieved: positions.length,
      lastQueryPositionTime,
      debugInfo: {
        authenticatedTokenLength: authenticatedToken?.length || 0,
        loginSuccess: !!authenticatedToken,
        deviceListRequestMade: true,
        positionRequestMade: devices.length > 0
      }
    };

    console.log('GPS51 sync completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('=== GPS51 SYNC ERROR (ENHANCED WITH DEBUG) ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      hadAuthenticatedToken: !!authenticatedToken
    });

    const executionTime = (Date.now() - startTime) / 1000;
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      executionTimeSeconds: executionTime,
      debugInfo: {
        authenticatedTokenAcquired: !!authenticatedToken,
        errorOccurredAt: 'See logs for details'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
