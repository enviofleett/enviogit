
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GPS51SyncRequest } from './types.ts';
import { GPS51Auth } from './auth.ts';
import { GPS51ApiClient } from './api-client.ts';
import { GPS51DataProcessor } from './data-processor.ts';
import { GPS51JobTracker } from './job-tracker.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('=== GPS51 SYNC STARTED (REFACTORED) ===');
    console.log('Timestamp:', new Date().toISOString());

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed. Only POST requests are supported.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    // Parse request body
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
      console.log("Request parsing note:", e);
      // Continue with empty requestBody for cron jobs
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { priority, batchMode, cronTriggered } = requestBody;

    // Initialize job tracker
    const jobTracker = new GPS51JobTracker(supabaseUrl, supabaseKey);
    await jobTracker.startJob(priority || 0, cronTriggered || false, batchMode || false);

    // Get GPS51 credentials
    console.log('Loading GPS51 credentials from Supabase secrets...');
    
    let finalApiUrl = requestBody.apiUrl || Deno.env.get('GPS51_API_URL') || 'https://api.gps51.com/openapi';
    let finalUsername = requestBody.username || Deno.env.get('GPS51_USERNAME');
    let finalPassword = requestBody.password || Deno.env.get('GPS51_PASSWORD_HASH');
    
    console.log('GPS51 credentials loaded:', {
      apiUrl: finalApiUrl,
      username: finalUsername ? finalUsername.substring(0, 3) + '***' : 'MISSING',
      hasPassword: !!finalPassword,
      passwordLength: finalPassword ? finalPassword.length : 0,
      from: 'WEB',
      type: 'USER'
    });

    if (!finalApiUrl || !finalUsername || !finalPassword) {
      const missingFields = [];
      if (!finalApiUrl) missingFields.push('apiUrl');
      if (!finalUsername) missingFields.push('username');
      if (!finalPassword) missingFields.push('password');
      
      console.error('GPS51 credentials validation failed:', {
        missingFields,
        hasApiUrl: !!finalApiUrl,
        hasUsername: !!finalUsername,
        hasPassword: !!finalPassword,
        availableEnvVars: Object.keys(Deno.env.toObject()).filter(k => k.startsWith('GPS51_'))
      });
      
      throw new Error(`GPS51 credentials not configured properly. Missing: ${missingFields.join(', ')}`);
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

    // Step 1: Authenticate with GPS51 API
    const auth = new GPS51Auth(correctedApiUrl, finalUsername, finalPassword);
    const token = await auth.login();

    // Step 2: Initialize API client and data processor
    const apiClient = new GPS51ApiClient(correctedApiUrl, token, finalUsername);
    const dataProcessor = new GPS51DataProcessor(supabaseUrl, supabaseKey);

    // Step 3: Fetch devices
    let devices = await apiClient.fetchDeviceList();

    // Step 4: Filter devices by priority if in batch mode
    if (batchMode && priority) {
      devices = await dataProcessor.filterDevicesByPriority(devices, priority);
    }

    // Step 5: Sync vehicles to database
    const vehicleSync = await dataProcessor.syncVehicles(devices);

    // Step 6: Fetch and store positions
    const deviceIds = devices.map(d => d.deviceid);
    const positions = await apiClient.fetchPositions(deviceIds);
    const positionSync = await dataProcessor.storePositions(positions);

    const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);

    // Complete job tracking
    const success = vehicleSync.errors.length === 0 && positionSync.errors.length === 0;
    const errorMessage = [...vehicleSync.errors, ...positionSync.errors].slice(0, 3).join('; ');
    
    await jobTracker.completeJob(
      success,
      vehicleSync.synced,
      positionSync.stored,
      executionTimeSeconds,
      errorMessage || undefined
    );

    // Build final summary
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      priority: priority || null,
      batchMode: batchMode || false,
      executionTimeSeconds,
      statistics: {
        devicesFound: devices.length,
        devicesFiltered: devices.length,
        positionsRetrieved: positions.length,
        vehiclesSynced: vehicleSync.synced,
        positionsStored: positionSync.stored,
        vehicleSyncErrors: vehicleSync.errors.length,
        positionStorageErrors: positionSync.errors.length,
        skippedPositions: positionSync.skipped.length
      },
      details: {
        vehicleSyncSuccessRate: devices.length > 0 ? Math.round((vehicleSync.synced / devices.length) * 100) : 0,
        positionStorageSuccessRate: positions.length > 0 ? Math.round((positionSync.stored / positions.length) * 100) : 0,
        positionsPerVehicleRatio: devices.length > 0 ? Math.round((positions.length / devices.length) * 100) / 100 : 0
      }
    };

    console.log('=== GPS51 SYNC COMPLETED (REFACTORED) ===');
    console.log('Final Summary:', summary);

    // Log errors for debugging
    if (vehicleSync.errors.length > 0) {
      console.log('Vehicle Sync Errors (first 5):', vehicleSync.errors.slice(0, 5));
    }
    if (positionSync.errors.length > 0) {
      console.log('Position Storage Errors (first 5):', positionSync.errors.slice(0, 5));
    }
    if (positionSync.skipped.length > 0) {
      console.log('Skipped Positions (first 5):', positionSync.skipped.slice(0, 5));
    }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== GPS51 SYNC ERROR (REFACTORED) ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
      timestamp: new Date().toISOString()
    });

    const executionTimeSeconds = Math.round((Date.now() - startTime) / 1000);
    
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
