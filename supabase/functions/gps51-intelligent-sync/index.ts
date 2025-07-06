import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IntelligentSyncRequest {
  action?: string;
  priority?: number;
  batchMode?: boolean;
  specificDevices?: string[];
  requestSource?: string;
  userActivity?: {
    userId: string;
    vehicleIds: string[];
    isViewingRealTime: boolean;
  };
}

interface GPS51Position {
  deviceid: string;
  callat: number;
  callon: number;
  speed: number;
  course: number;
  updatetime: number;
  moving: number;
  alarm: number;
  stralarm: string;
  totaldistance: number;
  totaloil: number;
  voltagev: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const requestBody: IntelligentSyncRequest = await req.json();
    const {
      action = 'intelligent_sync',
      priority = 2,
      batchMode = true,
      specificDevices = [],
      requestSource = 'api',
      userActivity
    } = requestBody;

    console.log('GPS51 Intelligent Sync: Processing request', {
      action,
      priority,
      batchMode,
      deviceCount: specificDevices.length,
      requestSource,
      hasUserActivity: !!userActivity
    });

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get GPS51 credentials
    const { data: credentials } = await supabaseClient
      .from('profiles')
      .select('notes')
      .not('notes', 'is', null)
      .limit(1)
      .single();

    if (!credentials?.notes) {
      throw new Error('GPS51 credentials not found');
    }

    const credentialsData = JSON.parse(credentials.notes);
    const { gps51_username, gps51_password } = credentialsData;

    if (!gps51_username || !gps51_password) {
      throw new Error('GPS51 credentials incomplete');
    }

    // Step 1: Authenticate with GPS51
    console.log('GPS51 Intelligent Sync: Authenticating...');
    const authResponse = await fetch('https://www.gps51.com/webapi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'checkuserlogin',
        username: gps51_username,
        password: gps51_password
      })
    });

    const authResult = await authResponse.json();
    if (authResult.status !== 0) {
      throw new Error(`GPS51 authentication failed: ${authResult.message}`);
    }

    const token = authResult.token;

    // Step 2: Determine devices to sync
    let deviceIds: string[] = [];
    
    if (specificDevices.length > 0) {
      deviceIds = specificDevices;
      console.log('GPS51 Intelligent Sync: Using specific devices', { count: deviceIds.length });
    } else {
      // Get all active vehicles from database
      const { data: vehicles } = await supabaseClient
        .from('vehicles')
        .select('gps51_device_id')
        .not('gps51_device_id', 'is', null)
        .eq('status', 'active');

      deviceIds = vehicles?.map(v => v.gps51_device_id) || [];
      console.log('GPS51 Intelligent Sync: Using all active vehicles', { count: deviceIds.length });
    }

    if (deviceIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No devices to sync',
        devicesProcessed: 0,
        positionsStored: 0,
        executionTime: Date.now() - startTime
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Step 3: Intelligent batch processing with priority handling
    const batchSize = priority === 1 ? 50 : 100; // Smaller batches for high priority
    const maxRetries = priority === 1 ? 3 : 2;
    let totalPositionsStored = 0;
    let devicesProcessed = 0;

    // Get last query times for incremental sync
    const { data: lastSyncJobs } = await supabaseClient
      .from('gps51_sync_jobs')
      .select('results')
      .eq('success', true)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    let lastQueryTime = 0;
    if (lastSyncJobs?.results?.lastQueryTime) {
      lastQueryTime = lastSyncJobs.results.lastQueryTime;
    }

    console.log('GPS51 Intelligent Sync: Using incremental sync', {
      lastQueryTime,
      lastQueryDate: lastQueryTime > 0 ? new Date(lastQueryTime).toISOString() : 'Never'
    });

    // Process devices in intelligent batches
    for (let i = 0; i < deviceIds.length; i += batchSize) {
      const batch = deviceIds.slice(i, i + batchSize);
      let retries = 0;
      let batchSuccess = false;

      while (!batchSuccess && retries < maxRetries) {
        try {
          console.log(`GPS51 Intelligent Sync: Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(deviceIds.length / batchSize)}`);

          // Fetch positions with intelligent lastquerypositiontime handling
          const positionResponse = await fetch('https://www.gps51.com/webapi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              action: 'lastposition',
              token: token,
              deviceids: batch.join(','),
              lastquerypositiontime: lastQueryTime.toString()
            })
          });

          const positionResult = await positionResponse.json();
          
          if (positionResult.status !== 0) {
            throw new Error(`GPS51 position fetch failed: ${positionResult.message}`);
          }

          const positions: GPS51Position[] = positionResult.positions || [];
          const newLastQueryTime = positionResult.lastquerypositiontime || lastQueryTime;

          console.log(`GPS51 Intelligent Sync: Batch ${Math.floor(i / batchSize) + 1} fetched`, {
            requestedDevices: batch.length,
            positionsReceived: positions.length,
            newLastQueryTime,
            hasNewData: positions.length > 0
          });

          // Store positions in database with intelligent filtering
          if (positions.length > 0) {
            const positionRecords = positions.map(pos => ({
              device_id: pos.deviceid,
              latitude: pos.callat,
              longitude: pos.callon,
              speed: pos.speed || 0,
              heading: pos.course || 0,
              timestamp: new Date(pos.updatetime).toISOString(),
              status: pos.moving ? 'moving' : 'stationary',
              raw_data: pos,
              ignition_status: pos.alarm === 0,
              battery_level: pos.voltagev ? Math.round(pos.voltagev * 10) : null,
              odometer: pos.totaldistance || 0,
              fuel_level: pos.totaloil || null
            }));

            const { error: insertError } = await supabaseClient
              .from('vehicle_positions')
              .insert(positionRecords);

            if (insertError) {
              console.error('GPS51 Intelligent Sync: Database insert error:', insertError);
            } else {
              totalPositionsStored += positions.length;
              console.log(`GPS51 Intelligent Sync: Stored ${positions.length} positions for batch`);
            }

            // Broadcast real-time updates for high-priority requests
            if (priority === 1) {
              for (const position of positions) {
                // This would integrate with WebSocket broadcasting
                console.log(`GPS51 Intelligent Sync: Broadcasting real-time update for device ${position.deviceid}`);
              }
            }
          }

          // Update lastQueryTime for next batch
          lastQueryTime = newLastQueryTime;
          devicesProcessed += batch.length;
          batchSuccess = true;

        } catch (batchError) {
          retries++;
          console.error(`GPS51 Intelligent Sync: Batch ${Math.floor(i / batchSize) + 1} attempt ${retries} failed:`, batchError);
          
          if (retries < maxRetries) {
            // Exponential backoff with jitter
            const delay = Math.min(1000 * Math.pow(2, retries - 1) + Math.random() * 1000, 10000);
            console.log(`GPS51 Intelligent Sync: Retrying batch in ${Math.round(delay)}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!batchSuccess) {
        console.error(`GPS51 Intelligent Sync: Batch ${Math.floor(i / batchSize) + 1} failed after ${maxRetries} attempts`);
      }

      // Smart delay between batches to avoid overwhelming GPS51 API
      if (i + batchSize < deviceIds.length) {
        const delayMs = priority === 1 ? 500 : 1000; // Shorter delay for high priority
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const executionTime = Date.now() - startTime;

    // Log sync job for tracking
    await supabaseClient.from('gps51_sync_jobs').insert({
      job_type: 'intelligent_sync',
      status: 'completed',
      success: true,
      priority,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      execution_time_ms: executionTime,
      vehicles_processed: devicesProcessed,
      positions_processed: totalPositionsStored,
      positions_stored: totalPositionsStored,
      sync_parameters: {
        action,
        priority,
        batchMode,
        batchSize,
        requestSource,
        specificDeviceCount: specificDevices.length,
        userActivity
      },
      results: {
        devicesProcessed,
        totalPositionsStored,
        lastQueryTime,
        executionTime,
        success: true
      }
    });

    console.log('GPS51 Intelligent Sync: Sync completed successfully', {
      devicesProcessed,
      totalPositionsStored,
      executionTime: `${executionTime}ms`,
      priority,
      requestSource
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Intelligent sync completed successfully',
      devicesProcessed,
      positionsStored: totalPositionsStored,
      lastQueryTime,
      executionTime,
      priority,
      requestSource,
      batchMode,
      efficiency: {
        positionsPerSecond: Math.round((totalPositionsStored / executionTime) * 1000),
        devicesPerSecond: Math.round((devicesProcessed / executionTime) * 1000)
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("GPS51 Intelligent Sync error:", error);
    
    const executionTime = Date.now() - startTime;

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      executionTime,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);