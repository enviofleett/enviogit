import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VehicleRegistrationRequest {
  deviceId: string;
  deviceName: string;
  deviceType?: string;
  gps51Token: string; // GPS51 authentication token
  userId: string; // Supabase user ID
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deviceId, deviceName, deviceType, gps51Token, userId }: VehicleRegistrationRequest = await req.json();

    // Validate required fields
    if (!deviceId || !deviceName || !gps51Token || !userId) {
      throw new Error("Device ID, device name, GPS51 token, and user ID are required");
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user profile to get GPS51 username
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      throw new Error("User profile not found");
    }

    const gps51Username = userProfile.notes ? 
      JSON.parse(userProfile.notes).gps51_username : 
      userProfile.email;

    console.log('Vehicle Registration: Adding device to GPS51:', {
      deviceId,
      deviceName,
      creater: gps51Username
    });

    // Add device to GPS51 via proxy
    const { data: proxyResponse, error: proxyError } = await supabaseClient.functions.invoke('gps51-proxy', {
      body: {
        action: 'adddevice',
        token: gps51Token,
        params: {
          deviceid: deviceId,
          devicename: deviceName,
          devicetype: deviceType || 'GPS',
          creater: gps51Username
        },
        method: 'POST'
      }
    });

    if (proxyError) {
      console.error('GPS51 device addition failed:', proxyError);
      throw new Error(`GPS51 device registration failed: ${proxyError.message}`);
    }

    // Check GPS51 response
    if (proxyResponse.status !== 0) {
      console.error('GPS51 device addition unsuccessful:', proxyResponse);
      throw new Error(`GPS51 device registration failed: ${proxyResponse.message || 'Unknown error'}`);
    }

    console.log('GPS51 device added successfully:', proxyResponse);

    // Store vehicle in Supabase
    const { data: vehicleData, error: vehicleError } = await supabaseClient
      .from('vehicles')
      .insert({
        gps51_device_id: deviceId,
        make: deviceName, // Use device name as make for now
        model: deviceType || 'GPS Tracker',
        status: 'active',
        subscriber_id: userId,
        notes: JSON.stringify({
          gps51_device_name: deviceName,
          registration_source: 'mobile_app'
        })
      })
      .select()
      .single();

    if (vehicleError) {
      console.error('Vehicle storage failed:', vehicleError);
      throw new Error(`Vehicle storage failed: ${vehicleError.message}`);
    }

    // Assign default subscription to vehicle
    const { data: userSubscription } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_packages(*)')
      .eq('user_id', userId)
      .eq('status', 'trial')
      .maybeSingle();

    if (userSubscription) {
      // Set trial expiration for this device using batchoperate
      const trialEndTimestamp = Math.floor(new Date(userSubscription.trial_end_date).getTime() / 1000);
      
      const { data: batchResponse } = await supabaseClient.functions.invoke('gps51-proxy', {
        body: {
          action: 'batchoperate',
          token: gps51Token,
          params: {
            deviceids: [deviceId],
            operation: 'ModifyExpiringTime',
            expiretime: trialEndTimestamp
          },
          method: 'POST'
        }
      });

      console.log('Set device trial expiration:', {
        deviceId,
        trialEndTimestamp,
        batchResponse
      });

      // Update subscription to link with vehicle
      await supabaseClient
        .from('user_subscriptions')
        .update({ vehicle_id: vehicleData.id })
        .eq('id', userSubscription.id);
    }

    console.log('Vehicle registration completed successfully:', {
      vehicleId: vehicleData.id,
      gps51DeviceId: deviceId
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Vehicle registered successfully",
      vehicle: {
        id: vehicleData.id,
        deviceId: deviceId,
        deviceName: deviceName,
        status: 'active'
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Vehicle registration error:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);