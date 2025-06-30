
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// MD5 implementation for Deno
async function md5(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.toLowerCase();
}

// GPS51 Response Analyzer (embedded for edge function)
function analyzeGPS51Response(apiResponseData: any, context: string = 'unknown') {
  console.log(`=== GPS51 RESPONSE ANALYZER (${context.toUpperCase()}) ===`);
  
  const responseKeys = Object.keys(apiResponseData || {});
  console.log('Response keys found:', responseKeys);
  console.log('Status:', apiResponseData?.status, '(type:', typeof apiResponseData?.status, ')');
  console.log('Cause:', apiResponseData?.cause);
  console.log('Token present:', !!apiResponseData?.token);
  console.log('Message:', apiResponseData?.message);
  
  const isSuccess = apiResponseData?.status === 0;
  const hasToken = !!apiResponseData?.token;
  
  console.log('Analysis result:', {
    isSuccess,
    hasToken,
    overallSuccess: isSuccess && (context === 'login' ? hasToken : true)
  });
  
  return {
    isSuccess,
    hasToken,
    status: apiResponseData?.status,
    cause: apiResponseData?.cause,
    token: apiResponseData?.token
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== GPS51 LIVE SYNC STARTED ===');
    console.log('Timestamp:', new Date().toISOString());

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load GPS51 credentials from environment
    const apiUrl = Deno.env.get('GPS51_API_URL') || 'https://api.gps51.com/openapi';
    const username = Deno.env.get('GPS51_USERNAME');
    const plainPassword = Deno.env.get('GPS51_PASSWORD'); // Plain text password
    const from = Deno.env.get('GPS51_FROM') || 'WEB';
    const type = Deno.env.get('GPS51_TYPE') || 'USER';

    console.log('GPS51 credentials loaded:', {
      apiUrl,
      username: username ? username.substring(0, 3) + '***' : 'missing',
      hasPassword: !!plainPassword,
      from,
      type
    });

    if (!username || !plainPassword) {
      throw new Error('GPS51 credentials not configured');
    }

    // === STEP 1: GPS51 AUTHENTICATION ===
    console.log('=== STEP 1: GPS51 AUTHENTICATION ===');
    
    // Hash the password using MD5
    const hashedPassword = await md5(plainPassword);
    console.log('Password hashed:', {
      originalLength: plainPassword.length,
      hashedLength: hashedPassword.length,
      isValidMD5: /^[a-f0-9]{32}$/.test(hashedPassword)
    });

    // Construct login request (POST with JSON body)
    const loginUrl = `${apiUrl}?action=login`;
    const loginBody = {
      username: username,
      password: hashedPassword,
      from: from,
      type: type
    };

    console.log('Login request details:', {
      url: loginUrl,
      method: 'POST',
      bodyKeys: Object.keys(loginBody),
      username: loginBody.username,
      passwordHashed: true,
      from: loginBody.from,
      type: loginBody.type
    });

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(loginBody)
    });

    if (!loginResponse.ok) {
      throw new Error(`Login HTTP error: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    console.log('GPS51 Login Response:', { 
      status: loginData.status, 
      hasToken: !!loginData.token,
      cause: loginData.cause,
      message: loginData.message
    });

    // Analyze login response
    const loginAnalysis = analyzeGPS51Response(loginData, 'login');
    
    if (!loginAnalysis.isSuccess || !loginAnalysis.hasToken) {
      const errorMsg = loginData.cause || loginData.message || `Authentication failed with status: ${loginData.status}`;
      throw new Error(`GPS51 authentication failed: ${errorMsg}`);
    }

    const token = loginData.token;
    console.log('Authentication successful, token received');

    // === STEP 2: FETCH DEVICE LIST ===
    console.log('=== STEP 2: FETCH DEVICE LIST ===');
    
    const deviceListUrl = `${apiUrl}?action=querymonitorlist&token=${token}`;
    const deviceListBody = {
      username: username
    };

    console.log('Device list request:', {
      url: deviceListUrl,
      method: 'POST',
      body: deviceListBody
    });

    const deviceResponse = await fetch(deviceListUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(deviceListBody)
    });

    if (!deviceResponse.ok) {
      throw new Error(`Device list HTTP error: ${deviceResponse.status} ${deviceResponse.statusText}`);
    }

    const deviceData = await deviceResponse.json();
    const deviceAnalysis = analyzeGPS51Response(deviceData, 'device-list');
    
    if (!deviceAnalysis.isSuccess) {
      throw new Error(`Failed to fetch device list: ${deviceData.cause || deviceData.message}`);
    }

    // Process devices
    let allDevices: any[] = [];
    if (deviceData.groups && Array.isArray(deviceData.groups)) {
      console.log(`Processing ${deviceData.groups.length} device groups`);
      
      deviceData.groups.forEach((group: any) => {
        if (group.devices && Array.isArray(group.devices)) {
          allDevices = allDevices.concat(group.devices);
        }
      });
    }

    console.log(`Total devices found: ${allDevices.length}`);

    // === STEP 3: SYNC TO SUPABASE ===
    console.log('=== STEP 3: SYNC TO SUPABASE ===');
    
    let vehiclesSynced = 0;
    let positionsStored = 0;

    // Sync vehicles to database
    if (allDevices.length > 0) {
      const vehicleData = allDevices.map(device => ({
        device_id: device.deviceid,
        device_name: device.devicename || 'Unknown',
        device_type: device.devicetype || 'Unknown',
        last_active: device.lastactivetime ? new Date(device.lastactivetime).toISOString() : null,
        status: device.status || 'unknown',
        group_name: device.groupname || 'Default',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: vehicleError } = await supabase
        .from('vehicles')
        .upsert(vehicleData, { 
          onConflict: 'device_id',
          ignoreDuplicates: false 
        });

      if (vehicleError) {
        console.error('Vehicle sync error:', vehicleError);
      } else {
        vehiclesSynced = vehicleData.length;
        console.log(`Synced ${vehiclesSynced} vehicles`);
      }
    }

    // === STEP 4: FETCH POSITIONS ===
    console.log('=== STEP 4: FETCH POSITIONS ===');
    
    if (allDevices.length > 0) {
      const deviceIds = allDevices.map(d => d.deviceid).slice(0, 50); // Limit to prevent overload
      
      const positionUrl = `${apiUrl}?action=lastposition&token=${token}`;
      const positionBody = {
        deviceids: deviceIds
      };

      console.log('Position request:', {
        url: positionUrl,
        deviceCount: deviceIds.length
      });

      const positionResponse = await fetch(positionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(positionBody)
      });

      if (positionResponse.ok) {
        const positionData = await positionResponse.json();
        const positionAnalysis = analyzeGPS51Response(positionData, 'positions');
        
        if (positionAnalysis.isSuccess && positionData.records) {
          const positions = Array.isArray(positionData.records) ? positionData.records : [];
          
          if (positions.length > 0) {
            const positionRecords = positions.map(pos => ({
              device_id: pos.deviceid,
              latitude: parseFloat(pos.latitude) || 0,
              longitude: parseFloat(pos.longitude) || 0,
              speed: parseFloat(pos.speed) || 0,
              timestamp: pos.utctime ? new Date(pos.utctime).toISOString() : new Date().toISOString(),
              altitude: parseFloat(pos.altitude) || 0,
              direction: parseFloat(pos.direction) || 0,
              satellites: parseInt(pos.satellites) || 0,
              created_at: new Date().toISOString()
            }));

            const { error: positionError } = await supabase
              .from('vehicle_positions')
              .insert(positionRecords);

            if (!positionError) {
              positionsStored = positionRecords.length;
              console.log(`Stored ${positionsStored} positions`);
            }
          }
        }
      }
    }

    console.log('=== GPS51 LIVE SYNC COMPLETED ===');
    console.log('Summary:', {
      vehiclesSynced,
      positionsStored,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        vehiclesSynced,
        positionsStored,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('=== GPS51 LIVE SYNC ERROR ===');
    console.error('Error:', error.message);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
