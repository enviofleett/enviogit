import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeatureAccessRequest {
  userId: string;
  vehicleId?: string;
  gps51Action: string;
  gps51Token: string;
  params?: Record<string, any>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, vehicleId, gps51Action, gps51Token, params }: FeatureAccessRequest = await req.json();

    // Validate required fields
    if (!userId || !gps51Action || !gps51Token) {
      throw new Error("User ID, GPS51 action, and token are required");
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user's subscription status
    let subscription = null;
    if (vehicleId) {
      // Check vehicle-specific subscription
      const { data: vehicleSubscription } = await supabaseClient
        .from('user_subscriptions')
        .select(`
          *,
          subscription_packages (*)
        `)
        .eq('user_id', userId)
        .eq('vehicle_id', vehicleId)
        .eq('status', 'active')
        .maybeSingle();

      subscription = vehicleSubscription;
    }

    // Fallback to user's general subscription
    if (!subscription) {
      const { data: userSubscription } = await supabaseClient
        .from('user_subscriptions')
        .select(`
          *,
          subscription_packages (*)
        `)
        .eq('user_id', userId)
        .or('status.eq.trial,status.eq.active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      subscription = userSubscription;
    }

    if (!subscription) {
      return new Response(JSON.stringify({
        success: false,
        error: "No active subscription found",
        upgradeRequired: true,
        availablePackages: await getAvailablePackages(supabaseClient)
      }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if subscription is expired
    const now = new Date();
    const isTrialExpired = subscription.status === 'trial' && 
      subscription.trial_end_date && 
      new Date(subscription.trial_end_date) < now;

    const isSubscriptionExpired = subscription.status === 'active' && 
      subscription.subscription_end_date && 
      new Date(subscription.subscription_end_date) < now;

    if (isTrialExpired || isSubscriptionExpired) {
      return new Response(JSON.stringify({
        success: false,
        error: isTrialExpired ? "Trial period has expired" : "Subscription has expired",
        upgradeRequired: true,
        subscriptionStatus: subscription.status,
        availablePackages: await getAvailablePackages(supabaseClient)
      }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get feature mapping for the GPS51 action
    const { data: featureMapping } = await supabaseClient
      .from('gps51_feature_mapping')
      .select('*')
      .or(`gps51_action.eq.${gps51Action},gps51_action.eq.all`)
      .limit(1)
      .maybeSingle();

    if (featureMapping) {
      // Check if user's subscription includes this feature
      const packageFeatures = subscription.subscription_packages.features as string[];
      const hasFeature = packageFeatures.includes(featureMapping.feature_name);

      if (!hasFeature) {
        return new Response(JSON.stringify({
          success: false,
          error: `Feature '${featureMapping.description}' is not available in your ${subscription.subscription_packages.name} plan`,
          upgradeRequired: true,
          currentPackage: subscription.subscription_packages.name,
          requiredFeature: featureMapping.feature_name,
          availablePackages: await getAvailablePackages(supabaseClient)
        }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Feature access granted - make the GPS51 API call
    console.log('Feature access granted:', {
      userId,
      vehicleId,
      action: gps51Action,
      packageName: subscription.subscription_packages.name,
      subscriptionStatus: subscription.status
    });

    const { data: proxyResponse, error: proxyError } = await supabaseClient.functions.invoke('gps51-proxy', {
      body: {
        action: gps51Action,
        token: gps51Token,
        params: params || {},
        method: 'POST'
      }
    });

    if (proxyError) {
      console.error('GPS51 API call failed:', proxyError);
      throw new Error(`GPS51 API call failed: ${proxyError.message}`);
    }

    // Log feature usage
    await supabaseClient
      .from('activity_logs')
      .insert({
        user_id: userId,
        activity_type: 'feature_access',
        description: `Used feature: ${gps51Action}`,
        metadata: {
          gps51_action: gps51Action,
          vehicle_id: vehicleId,
          package_name: subscription.subscription_packages.name,
          subscription_status: subscription.status
        }
      });

    return new Response(JSON.stringify({
      success: true,
      data: proxyResponse,
      subscription: {
        package: subscription.subscription_packages.name,
        status: subscription.status,
        expiresAt: subscription.status === 'trial' ? 
          subscription.trial_end_date : 
          subscription.subscription_end_date
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Feature access control error:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

async function getAvailablePackages(supabaseClient: any) {
  const { data: packages } = await supabaseClient
    .from('subscription_packages')
    .select('*')
    .eq('is_active', true)
    .order('price_quarterly', { ascending: true });

  return packages || [];
}

serve(handler);