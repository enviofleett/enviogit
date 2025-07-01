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

  const startTime = Date.now();
  let jobId: string | null = null;

  try {
    console.log('=== GPS51 SYNC STARTED (ENHANCED) ===');
    console.log('Timestamp:', new Date().toISOString());

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed. Only POST requests are supported.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    let requestBody: any;
    try {
      const requestText = await req.text();
      console.log('Request received:', {
        bodyLength: requestText.length,
        hasContent: !!requestText.trim()
      });
      
      if (!requestText || requestText.trim() === '') {
        throw new Error('Empty request body received');
      }

      requestBody = JSON.parse(requestText);
      console.log("GPS51 Sync Request validation:", {
        hasUsername: !!requestBody.username,
        hasPassword: !!requestBody.password,
        hasApiUrl: !!requestBody.apiUrl,
        passwordLength: requestBody.password?.length || 0,
        apiUrl: requestBody.apiUrl,
        priority: requestBody.priority,
        batchMode: requestBody.batchMode,
        cronTriggered: requestBody.cronTriggered || false
      });
    } catch (e) {
      console.error("Request parsing error:", e);
      return new Response(JSON.stringify({ error: 'Invalid or empty request body. Expected JSON.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { username, password, apiUrl, priority, batchMode, cronTriggered } = requestBody;

    // Log job start if triggered by cron or in batch mode
    if (cronTriggered || (batchMode && priority)) {
      const { data: jobData, error: jobError } = await supabase
        .from('gps51_sync_jobs')
        .insert({
          priority: priority || 0,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (!jobError && jobData) {
        jobId = jobData.id;
        console.log(`Job logged with ID: ${jobId}`);
      }
    }

    // Get credentials from localStorage if not provided (for cron jobs)
    let finalApiUrl = apiUrl;
    let finalUsername = username;
    let finalPassword = password;

    if (!finalApiUrl || !finalUsername || !finalPassword) {
      console.log('Getting credentials from system settings...');
      // For cron jobs, we need to get credentials from a secure location
      // This is a placeholder - in production, store these securely
      finalApiUrl = Deno.env.get('GPS51_API_URL') || apiUrl;
      finalUsername = Deno.env.get('GPS51_USERNAME') || username;
      finalPassword = Deno.env.get('GPS51_PASSWORD_HASH') || password;
    }

    if (!finalApiUrl || !finalUsername || !finalPassword) {
      throw new Error('GPS51 credentials not available for automated sync');
    }
    
    // Ensure we use the correct GPS51 API URL
    let correctedApiUrl = finalApiUrl.replace(/\/$/, '');
    if (correctedApiUrl.includes('www.gps51.com')) {
      console.log('Correcting API URL from www.gps51.com to api.gps51.com');
      correctedApiUrl = correctedApiUrl.replace('www.gps51.com', 'api.gps51.com');
    }

    console.log('Using API URL:', correctedApiUrl);
    if (batchMode && priority) {
      console.log(`BATCH MODE: Processing Priority ${priority} vehicles`);
    }

    // Generate a proper random token for the login request
    const generateToken = () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    // Step 1: Authenticate with GPS51 API
    const loginToken = generateToken();
    const loginUrl = new URL(correctedApiUrl);
    loginUrl.searchParams.append('action', 'login');
    loginUrl.searchParams.append('token', loginToken);

    const loginPayload = {
      username: finalUsername,
      password: finalPassword,
      from: 'WEB',
      type: 'USER'
    };

    console.log("=== GPS51 LOGIN ATTEMPT ===");
    console.log("Login URL:", loginUrl.toString());
    console.log("Login payload validation:", {
      username: loginPayload.username,
      passwordLength: loginPayload.password.length,
      isValidMD5: /^[a-f0-9]{32}$/.test(loginPayload.password),
      from: loginPayload.from,
      type: loginPayload.type
    });

    const loginResponse = await fetch(loginUrl.toString(), {
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
      bodyLength: loginResponseText.length,
      bodyPreview: loginResponseText.substring(0, 200)
    });

    if (!loginResponse.ok) {
      throw new Error(`GPS51 login HTTP error: ${loginResponse.status} ${loginResponse.statusText} - ${loginResponseText}`);
    }

    let loginData: any;
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

    const token = loginData.token;
    console.log('GPS51 login successful, token acquired');

    // Step 2: Fetch device list
    const deviceListUrl = new URL(correctedApiUrl);
    deviceListUrl.searchParams.append('action', 'querymonitorlist');
    deviceListUrl.searchParams.append('token', token);

    console.log("=== FETCHING DEVICE LIST ===");
    const deviceResponse = await fetch(deviceListUrl.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: finalUsername })
    });

    const deviceResponseText = await deviceResponse.text();
    console.log(`Device List Response:`, {
      status: deviceResponse.status,
      bodyLength: deviceResponseText.length,
      bodyPreview: deviceResponseText.substring(0, 300)
    });

    let devices: any[] = [];
    let deviceIds: string[] = [];
    
    if (deviceResponse.ok && deviceResponseText.trim()) {
      try {
        const deviceData = JSON.parse(deviceResponseText);
        console.log('Device Data Analysis:', {
          status: deviceData.status,
          hasGroups: !!deviceData.groups,
          groupsLength: deviceData.groups?.length || 0,
          rawKeys: Object.keys(deviceData)
        });
        
        if (deviceData.status === 0 && deviceData.groups) {
          deviceData.groups.forEach((group: any) => {
            console.log(`Processing group: ${group.groupname}, devices: ${group.devices?.length || 0}`);
            if (group.devices && Array.isArray(group.devices)) {
              devices = devices.concat(group.devices);
              group.devices.forEach((device: any) => {
                deviceIds.push(device.deviceid);
              });
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse device response:', e);
      }
    }

    console.log(`Device Summary: Found ${devices.length} devices, IDs: ${deviceIds.slice(0, 5).join(', ')}${deviceIds.length > 5 ? '...' : ''}`);

    // BATCH MODE: Filter devices by priority if specified
    let filteredDevices = devices;
    if (batchMode && priority) {
      console.log(`=== BATCH MODE: FILTERING BY PRIORITY ${priority} ===`);
      
      // Get vehicle data from database to determine priorities
      const { data: dbVehicles, error: dbError } = await supabase
        .from('vehicles')
        .select(`
          gps51_device_id,
          status,
          updated_at,
          vehicle_positions!left(
            timestamp,
            ignition_status,
            speed
          )
        `);

      if (dbError) {
        console.error('Error fetching vehicles for priority filtering:', dbError);
      } else {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const priorityDeviceIds = new Set<string>();

        dbVehicles?.forEach(vehicle => {
          if (!vehicle.gps51_device_id) return;

          const latestPosition = Array.isArray(vehicle.vehicle_positions) 
            ? vehicle.vehicle_positions.sort((a, b) => 
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              )[0]
            : vehicle.vehicle_positions;

          const lastPositionTime = latestPosition ? new Date(latestPosition.timestamp) : null;
          const isRecentlyActive = lastPositionTime && lastPositionTime > oneHourAgo;
          const isMoving = latestPosition?.ignition_status || (latestPosition?.speed || 0) > 0;
          const hasRecentPosition = lastPositionTime && lastPositionTime > oneDayAgo;

          let vehiclePriority = 4; // Default to inactive

          if (isRecentlyActive && isMoving) {
            vehiclePriority = 1; // Active/Moving
          } else if (vehicle.status === 'assigned' && hasRecentPosition) {
            vehiclePriority = 2; // Assigned with recent activity
          } else if (vehicle.status === 'available' && hasRecentPosition) {
            vehiclePriority = 3; // Available with recent activity
          }

          if (vehiclePriority === priority) {
            priorityDeviceIds.add(vehicle.gps51_device_id);
          }
        });

        // Filter devices by priority
        filteredDevices = devices.filter(device => priorityDeviceIds.has(device.deviceid));
        deviceIds = filteredDevices.map(d => d.deviceid);

        console.log(`Priority ${priority} filtering result:`, {
          originalDeviceCount: devices.length,
          filteredDeviceCount: filteredDevices.length,
          priorityDeviceIds: Array.from(priorityDeviceIds).slice(0, 5)
        });
      }
    }

    // Step 3: Fetch positions for filtered devices
    let positions: any[] = [];
    if (deviceIds.length > 0) {
      const positionUrl = new URL(correctedApiUrl);
      positionUrl.searchParams.append('action', 'lastposition');
      positionUrl.searchParams.append('token', token);

      const positionPayload = {
        deviceids: deviceIds,
        lastquerypositiontime: 0
      };

      console.log("=== FETCHING POSITIONS ===");
      console.log("Position request payload:", {
        deviceCount: positionPayload.deviceids.length,
        firstFewIds: positionPayload.deviceids.slice(0, 3),
        lastQueryTime: positionPayload.lastquerypositiontime
      });

      const positionResponse = await fetch(positionUrl.toString(), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(positionPayload)
      });

      const positionResponseText = await positionResponse.text();
      console.log(`Position Response Analysis:`, {
        status: positionResponse.status,
        statusText: positionResponse.statusText,
        bodyLength: positionResponseText.length,
        bodyPreview: positionResponseText.substring(0, 500),
        isEmptyOrNull: !positionResponseText.trim() || positionResponseText === 'null'
      });

      if (positionResponse.ok && positionResponseText.trim() && positionResponseText !== 'null') {
        try {
          const positionData = JSON.parse(positionResponseText);
          console.log('Position Data Structure Analysis:', {
            status: positionData.status,
            hasRecords: !!positionData.records,
            hasData: !!positionData.data,
            recordsLength: positionData.records?.length || 0,
            dataLength: positionData.data?.length || 0,
            responseKeys: Object.keys(positionData),
            firstRecord: positionData.records?.[0] || positionData.data?.[0] || null
          });
          
          if (positionData.status === 0) {
            if (positionData.records && Array.isArray(positionData.records)) {
              positions = positionData.records;
              console.log(`✅ Found ${positions.length} positions in 'records' field`);
            } else if (positionData.data && Array.isArray(positionData.data)) {
              positions = positionData.data;
              console.log(`✅ Found ${positions.length} positions in 'data' field`);
            } else {
              console.log('⚠️ No position array found in response');
            }
          } else {
            console.log(`❌ Position API returned error status: ${positionData.status}`);
          }
        } catch (e) {
          console.error('❌ Failed to parse position response:', e);
        }
      } else {
        console.log('⚠️ No valid position data received or null response');
      }
    } else {
      console.log('⚠️ No devices found for the specified priority, skipping position fetch');
    }

    console.log(`Position Summary: Found ${positions.length} positions for ${deviceIds.length} devices`);

    // Step 4: Sync vehicles to database with proper error handling
    let vehiclesSynced = 0;
    const vehicleSyncErrors: string[] = [];
    
    console.log("=== SYNCING VEHICLES ===");
    
    for (const device of filteredDevices) {
      try {
        const vehicleData = {
          license_plate: device.devicename,
          gps51_device_id: device.deviceid,
          brand: 'GPS51',
          model: `Device ${device.devicetype}`,
          type: mapDeviceTypeToVehicleType(device.devicetype),
          status: (device.isfree === 1 ? 'available' : 'assigned') as 'available' | 'inactive' | 'maintenance' | 'assigned',
          notes: `Device ID: ${device.deviceid}, SIM: ${device.simnum}, Last Active: ${new Date(device.lastactivetime).toISOString()}`,
          updated_at: new Date().toISOString(),
        };

        console.log(`Syncing vehicle: ${device.devicename} (${device.deviceid})`);

        const { data: vehicleResult, error: vehicleError } = await supabase
          .from('vehicles')
          .upsert(vehicleData, { onConflict: 'license_plate' })
          .select('id')
          .single();

        if (!vehicleError && vehicleResult) {
          vehiclesSynced++;
          console.log(`✅ Vehicle synced: ${device.devicename} -> DB ID: ${vehicleResult.id}`);
        } else {
          const errorMsg = `Vehicle sync failed for ${device.deviceid}: ${vehicleError?.message || 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          vehicleSyncErrors.push(errorMsg);
        }
      } catch (err) {
        const errorMsg = `Exception syncing vehicle ${device.deviceid}: ${err}`;
        console.error(`❌ ${errorMsg}`);
        vehicleSyncErrors.push(errorMsg);
      }
    }

    console.log(`Vehicle Sync Summary: ${vehiclesSynced}/${filteredDevices.length} vehicles synced successfully`);
    if (vehicleSyncErrors.length > 0) {
      console.log('Vehicle Sync Errors:', vehicleSyncErrors.slice(0, 5));
    }

    // Step 5: Store positions with enhanced validation and error handling
    let positionsStored = 0;
    const positionStorageErrors: string[] = [];
    const skippedPositions: string[] = [];

    console.log("=== STORING POSITIONS ===");
    console.log(`Processing ${positions.length} positions...`);

    for (const position of positions) {
      try {
        console.log(`Processing position for device: ${position.deviceid}`);

        // Enhanced validation for position data
        if (!position.deviceid || typeof position.callat !== 'number' || typeof position.callon !== 'number') {
          const skipMsg = `Invalid position data for ${position.deviceid}: lat=${position.callat}, lon=${position.callon}`;
          console.warn(`⚠️ ${skipMsg}`);
          skippedPositions.push(skipMsg);
          continue;
        }

        // Validate coordinates are within reasonable bounds
        if (Math.abs(position.callat) > 90 || Math.abs(position.callon) > 180) {
          const skipMsg = `Invalid coordinates for ${position.deviceid}: lat=${position.callat}, lon=${position.callon}`;
          console.warn(`⚠️ ${skipMsg}`);
          skippedPositions.push(skipMsg);
          continue;
        }

        // Find vehicle by GPS51 device ID with better error handling
        const { data: vehicle, error: vehicleQueryError } = await supabase
          .from('vehicles')
          .select('id, license_plate')
          .eq('gps51_device_id', position.deviceid)
          .single();

        if (vehicleQueryError || !vehicle) {
          const skipMsg = `Vehicle not found for GPS51 device ${position.deviceid}: ${vehicleQueryError?.message || 'No matching vehicle'}`;
          console.warn(`⚠️ ${skipMsg}`);
          skippedPositions.push(skipMsg);
          continue;
        }

        // Validate timestamp
        const positionTimestamp = new Date(position.updatetime);
        if (isNaN(positionTimestamp.getTime())) {
          const skipMsg = `Invalid timestamp for ${position.deviceid}: ${position.updatetime}`;
          console.warn(`⚠️ ${skipMsg}`);
          skippedPositions.push(skipMsg);
          continue;
        }

        const positionData = {
          vehicle_id: vehicle.id,
          latitude: Number(position.callat),
          longitude: Number(position.callon),
          speed: Number(position.speed || 0),
          heading: Number(position.course || 0),
          timestamp: positionTimestamp.toISOString(),
          ignition_status: position.moving === 1,
          fuel_level: position.voltagepercent ? Number(position.voltagepercent) : null,
          engine_temperature: position.temp1 ? Number(position.temp1) : null,
          address: position.strstatus || null,
          recorded_at: new Date().toISOString()
        };

        console.log(`Storing position for vehicle ${vehicle.license_plate} (${vehicle.id}):`, {
          deviceId: position.deviceid,
          lat: positionData.latitude,
          lon: positionData.longitude,
          speed: positionData.speed,
          timestamp: positionData.timestamp,
          ignition: positionData.ignition_status
        });

        const { error: positionError } = await supabase
          .from('vehicle_positions')
          .upsert(positionData, { 
            onConflict: 'vehicle_id,timestamp',
            ignoreDuplicates: false 
          });

        if (!positionError) {
          positionsStored++;
          console.log(`✅ Position stored for ${position.deviceid} -> ${vehicle.license_plate}`);
        } else {
          const errorMsg = `Position storage failed for ${position.deviceid}: ${positionError.message}`;
          console.error(`❌ ${errorMsg}`);
          positionStorageErrors.push(errorMsg);
        }
      } catch (err) {
        const errorMsg = `Exception storing position for ${position.deviceid}: ${err}`;
        console.error(`❌ ${errorMsg}`);
        positionStorageErrors.push(errorMsg);
      }
    }

    const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);

    // Update job completion status
    if (jobId) {
      const success = vehicleSyncErrors.length === 0 && positionStorageErrors.length === 0;
      const errorMessage = [...vehicleSyncErrors, ...positionStorageErrors].slice(0, 3).join('; ');
      
      await supabase
        .from('gps51_sync_jobs')
        .update({
          completed_at: new Date().toISOString(),
          success,
          vehicles_processed: vehiclesSynced,
          positions_stored: positionsStored,
          error_message: errorMessage || null,
          execution_time_seconds: executionTimeSeconds
        })
        .eq('id', jobId);

      console.log(`Job ${jobId} completed: success=${success}, vehicles=${vehiclesSynced}, positions=${positionsStored}`);
    }

    // Final summary with detailed statistics
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      priority: priority || null,
      batchMode: batchMode || false,
      executionTimeSeconds,
      statistics: {
        devicesFound: devices.length,
        devicesFiltered: filteredDevices.length,
        positionsRetrieved: positions.length,
        vehiclesSynced,
        positionsStored,
        vehicleSyncErrors: vehicleSyncErrors.length,
        positionStorageErrors: positionStorageErrors.length,
        skippedPositions: skippedPositions.length
      },
      details: {
        vehicleSyncSuccessRate: filteredDevices.length > 0 ? Math.round((vehiclesSynced / filteredDevices.length) * 100) : 0,
        positionStorageSuccessRate: positions.length > 0 ? Math.round((positionsStored / positions.length) * 100) : 0,
        positionsPerVehicleRatio: filteredDevices.length > 0 ? Math.round((positions.length / filteredDevices.length) * 100) / 100 : 0
      }
    };

    console.log('=== GPS51 SYNC COMPLETED (ENHANCED) ===');
    console.log('Final Summary:', summary);

    // Log errors for debugging
    if (vehicleSyncErrors.length > 0) {
      console.log('Vehicle Sync Errors (first 5):', vehicleSyncErrors.slice(0, 5));
    }
    if (positionStorageErrors.length > 0) {
      console.log('Position Storage Errors (first 5):', positionStorageErrors.slice(0, 5));
    }
    if (skippedPositions.length > 0) {
      console.log('Skipped Positions (first 5):', skippedPositions.slice(0, 5));
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== GPS51 SYNC ERROR (ENHANCED) ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
      timestamp: new Date().toISOString()
    });

    const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);
    
    // Update job with error status
    if (jobId) {
      await supabase
        .from('gps51_sync_jobs')
        .update({
          completed_at: new Date().toISOString(),
          success: false,
          error_message: error.message,
          execution_time_seconds: executionTimeSeconds
        })
        .eq('id', jobId);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        executionTimeSeconds
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
