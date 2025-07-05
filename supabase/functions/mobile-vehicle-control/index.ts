import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VehicleControlRequest {
  userId: string;
  vehicleId: string;
  action: 'engine_start' | 'engine_stop' | 'immobilizer_on' | 'immobilizer_off' | 'locate';
  gps51Token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, vehicleId, action, gps51Token }: VehicleControlRequest = await req.json();

    if (!userId || !vehicleId || !action || !gps51Token) {
      throw new Error("All fields are required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get vehicle details
    const { data: vehicle, error: vehicleError } = await supabaseClient
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .eq('subscriber_id', userId)
      .single();

    if (vehicleError || !vehicle) {
      throw new Error("Vehicle not found or access denied");
    }

    // Check feature access through feature-access-control
    const { data: accessResponse, error: accessError } = await supabaseClient.functions.invoke('feature-access-control', {
      body: {
        userId,
        vehicleId,
        gps51Action: 'sendcmd',
        gps51Token,
        params: {
          deviceid: vehicle.gps51_device_id,
          cmdtype: action.toUpperCase(),
          content: ''
        }
      }
    });

    if (accessError || !accessResponse.success) {
      return new Response(JSON.stringify({
        success: false,
        error: accessResponse?.error || "Feature access denied",
        upgradeRequired: accessResponse?.upgradeRequired || false
      }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Log control action
    await supabaseClient
      .from('activity_logs')
      .insert({
        user_id: userId,
        activity_type: 'vehicle_control',
        description: `${action} command sent to vehicle ${vehicle.gps51_device_id}`,
        metadata: {
          vehicle_id: vehicleId,
          action,
          device_id: vehicle.gps51_device_id
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: "Vehicle command executed successfully",
      action,
      vehicleId,
      commandResponse: accessResponse.data
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Mobile vehicle control error:", error);
    
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