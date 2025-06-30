
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51Device {
  deviceid: string;
  devicename: string;
  devicetype: number;
  simnum: string;
  lastactivetime: number;
  isfree: number;
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
  voltage?: number;
  fuel?: number;
  altitude?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('=== GPS51 LIVE SYNC STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get GPS51 credentials from secrets
    const apiUrl = Deno.env.get('GPS51_API_URL');
    const username = Deno.env.get('GPS51_USERNAME');
    const passwordHash = Deno.env.get('GPS51_PASSWORD_HASH');

    if (!apiUrl || !username || !passwordHash) {
      throw new Error('GPS51 credentials not configured in environment variables');
    }

    console.log('GPS51 credentials loaded:', { apiUrl, username: username.substring(0, 3) + '***' });

    // Generate token for GPS51 API
    const generateToken = () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    // Step 1: Authenticate with GPS51
    console.log('=== STEP 1: GPS51 AUTHENTICATION ===');
    const loginToken = generateToken();
    const loginUrl = new URL(apiUrl);
    loginUrl.searchParams.append('action', 'login');
    loginUrl.searchParams.append('token', loginToken);

    const loginPayload = {
      username,
      password: passwordHash,
      from: 'WEB',
      type: 'USER'
    };

    const loginResponse = await fetch(loginUrl.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload)
    });

    if (!loginResponse.ok) {
      throw new Error(`GPS51 login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    console.log('GPS51 Login Response:', { status: loginData.status, hasToken: !!loginData.token });

    if (loginData.status !== 0 || !loginData.token) {
      throw new Error(`GPS51 authentication failed: ${loginData.message || loginData.cause}`);
    }

    const authToken = loginData.token;
    console.log('✅ GPS51 authentication successful');

    // Step 2: Fetch device list
    console.log('=== STEP 2: FETCH DEVICE LIST ===');
    const deviceListUrl = new URL(apiUrl);
    deviceListUrl.searchParams.append('action', 'querymonitorlist');
    deviceListUrl.searchParams.append('token', authToken);

    const deviceResponse = await fetch(deviceListUrl.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username })
    });

    if (!deviceResponse.ok) {
      throw new Error(`Device list fetch failed: ${deviceResponse.status} ${deviceResponse.statusText}`);
    }

    const deviceData = await deviceResponse.json();
    console.log('Device List Response:', { status: deviceData.status, hasGroups: !!deviceData.groups });

    let devices: GPS51Device[] = [];
    if (deviceData.status === 0 && deviceData.groups) {
      deviceData.groups.forEach((group: any) => {
        if (group.devices && Array.isArray(group.devices)) {
          devices = devices.concat(group.devices);
        }
      });
    }

    console.log(`📱 Found ${devices.length} GPS51 devices`);

    if (devices.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No devices found',
        devicesFound: 0,
        positionsRetrieved: 0,
        executionTimeMs: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Filter active devices to improve success rate
    console.log('=== STEP 3: FILTER ACTIVE DEVICES ===');
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const sixHoursAgo = now - (6 * 60 * 60 * 1000);

    const activeDevices = devices.filter(device => {
      if (device.lastactivetime && device.lastactivetime > oneHourAgo) {
        return true; // Active in last hour
      }
      if (device.lastactivetime && device.lastactivetime > sixHoursAgo) {
        return true; // Active in last 6 hours
      }
      if (!device.lastactivetime) {
        return true; // Include devices without activity time (might be new)
      }
      return false;
    });

    console.log(`📡 Filtered to ${activeDevices.length} active devices from ${devices.length} total`);

    // Step 4: Fetch live positions for active devices
    console.log('=== STEP 4: FETCH LIVE POSITIONS ===');
    let positions: GPS51Position[] = [];
    
    if (activeDevices.length > 0) {
      const deviceIds = activeDevices.map(d => d.deviceid);
      const positionUrl = new URL(apiUrl);
      positionUrl.searchParams.append('action', 'lastposition');
      positionUrl.searchParams.append('token', authToken);

      // Get last query time from database for incremental updates
      const { data: lastSyncData } = await supabase
        .from('gps51_sync_jobs')
        .select('completed_at')
        .eq('success', true)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      const lastQueryTime = lastSyncData?.completed_at 
        ? new Date(lastSyncData.completed_at).getTime()
        : 0;

      const positionPayload: any = { deviceids: deviceIds };
      if (lastQueryTime > 0) {
        positionPayload.lastquerypositiontime = lastQueryTime;
      }

      console.log('Position request:', {
        deviceCount: deviceIds.length,
        lastQueryTime: lastQueryTime > 0 ? new Date(lastQueryTime).toISOString() : 'initial',
        isIncremental: lastQueryTime > 0
      });

      const positionResponse = await fetch(positionUrl.toString(), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(positionPayload)
      });

      if (positionResponse.ok) {
        const positionData = await positionResponse.json();
        console.log('Position Response:', {
          status: positionData.status,
          hasRecords: !!positionData.records,
          recordCount: positionData.records?.length || 0
        });

        if (positionData.status === 0) {
          positions = positionData.records || positionData.data || [];
        }
      } else {
        console.warn('Position fetch failed:', positionResponse.status, positionResponse.statusText);
      }
    }

    console.log(`📍 Retrieved ${positions.length} live positions`);

    // Step 5: Store positions in database
    console.log('=== STEP 5: STORE POSITIONS IN DATABASE ===');
    let positionsStored = 0;
    const errors: string[] = [];

    for (const position of positions) {
      try {
        // Validate position data
        if (!position.deviceid || typeof position.callat !== 'number' || typeof position.callon !== 'number') {
          errors.push(`Invalid position data for device ${position.deviceid}`);
          continue;
        }

        // Validate coordinates
        if (Math.abs(position.callat) > 90 || Math.abs(position.callon) > 180) {
          errors.push(`Invalid coordinates for device ${position.deviceid}: ${position.callat}, ${position.callon}`);
          continue;
        }

        // Find vehicle by GPS51 device ID
        const { data: vehicle, error: vehicleError } = await supabase
          .from('vehicles')
          .select('id, license_plate')
          .eq('gps51_device_id', position.deviceid)
          .single();

        if (vehicleError || !vehicle) {
          errors.push(`Vehicle not found for GPS51 device ${position.deviceid}`);
          continue;
        }

        // Store position
        const positionData = {
          vehicle_id: vehicle.id,
          latitude: Number(position.callat),
          longitude: Number(position.callon),
          speed: Number(position.speed || 0),
          heading: Number(position.course || 0),
          altitude: Number(position.altitude || 0),
          timestamp: new Date(position.updatetime).toISOString(),
          ignition_status: position.moving === 1,
          fuel_level: position.fuel ? Number(position.fuel) : null,
          engine_temperature: position.temp1 ? Number(position.temp1) : null,
          battery_level: position.voltage ? Number(position.voltage) : null,
          address: position.strstatus || null,
          recorded_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('vehicle_positions')
          .insert(positionData);

        if (!insertError) {
          positionsStored++;
          console.log(`✅ Position stored for vehicle ${vehicle.license_plate}`);
        } else {
          errors.push(`Failed to store position for ${position.deviceid}: ${insertError.message}`);
        }
      } catch (err) {
        errors.push(`Error processing position for ${position.deviceid}: ${err}`);
      }
    }

    // Step 6: Log sync job
    const executionTimeMs = Date.now() - startTime;
    const success = errors.length === 0;

    await supabase
      .from('gps51_sync_jobs')
      .insert({
        priority: 1,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        success,
        vehicles_processed: devices.length,
        positions_stored: positionsStored,
        execution_time_seconds: Math.round(executionTimeMs / 1000),
        error_message: errors.length > 0 ? errors.slice(0, 3).join('; ') : null
      });

    console.log('=== GPS51 LIVE SYNC COMPLETED ===');
    console.log('Summary:', {
      devicesFound: devices.length,
      activeDevices: activeDevices.length,
      positionsRetrieved: positions.length,
      positionsStored,
      errors: errors.length,
      executionTimeMs
    });

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      devicesFound: devices.length,
      activeDevices: activeDevices.length,
      positionsRetrieved: positions.length,
      positionsStored,
      errors: errors.length > 0 ? errors.slice(0, 5) : [],
      executionTimeMs
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== GPS51 LIVE SYNC ERROR ===');
    console.error('Error:', error.message);

    const executionTimeMs = Date.now() - startTime;

    // Log failed sync job
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('gps51_sync_jobs')
        .insert({
          priority: 1,
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          success: false,
          vehicles_processed: 0,
          positions_stored: 0,
          execution_time_seconds: Math.round(executionTimeMs / 1000),
          error_message: error.message
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      executionTimeMs
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
