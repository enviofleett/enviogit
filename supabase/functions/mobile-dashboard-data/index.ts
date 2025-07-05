import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DashboardRequest {
  userId: string;
  gps51Token: string;
  includePositions?: boolean;
  includeAlerts?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, gps51Token, includePositions = true, includeAlerts = true }: DashboardRequest = await req.json();

    if (!userId || !gps51Token) {
      throw new Error("User ID and GPS51 token are required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user's vehicles and subscription info
    const { data: vehicles, error: vehiclesError } = await supabaseClient
      .from('vehicles')
      .select(`
        *,
        user_subscriptions!inner(
          *,
          subscription_packages(*)
        )
      `)
      .eq('subscriber_id', userId);

    if (vehiclesError) {
      throw new Error(`Failed to fetch vehicles: ${vehiclesError.message}`);
    }

    const dashboardData: any = {
      vehicles: vehicles || [],
      summary: {
        totalVehicles: vehicles?.length || 0,
        activeVehicles: 0,
        inactiveVehicles: 0
      }
    };

    // Get vehicle positions if requested
    if (includePositions && vehicles && vehicles.length > 0) {
      const deviceIds = vehicles.map(v => v.gps51_device_id).filter(Boolean);
      
      if (deviceIds.length > 0) {
        // Get positions through feature access control
        const { data: positionsResponse } = await supabaseClient.functions.invoke('feature-access-control', {
          body: {
            userId,
            gps51Action: 'querymonitorlist',
            gps51Token,
            params: {}
          }
        });

        if (positionsResponse?.success && positionsResponse?.data?.devices) {
          dashboardData.positions = positionsResponse.data.devices;
          
          // Update summary based on device status
          dashboardData.summary.activeVehicles = positionsResponse.data.devices.filter((d: any) => d.status === 1).length;
          dashboardData.summary.inactiveVehicles = positionsResponse.data.devices.filter((d: any) => d.status !== 1).length;
        }
      }
    }

    // Get recent activity logs
    const { data: recentActivity } = await supabaseClient
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    dashboardData.recentActivity = recentActivity || [];

    // Get subscription status
    const subscription = vehicles?.[0]?.user_subscriptions?.[0];
    if (subscription) {
      dashboardData.subscription = {
        package: subscription.subscription_packages.name,
        status: subscription.status,
        trialEnd: subscription.trial_end_date,
        subscriptionEnd: subscription.subscription_end_date,
        features: subscription.subscription_packages.features
      };
    }

    return new Response(JSON.stringify({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Mobile dashboard data error:", error);
    
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