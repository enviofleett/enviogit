import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FuelInsightsRequest {
  vehicleId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate?: string;
  endDate?: string;
  subscriptionTier?: string;
}

interface FuelInsightsResponse {
  success: boolean;
  insights?: any;
  subscriptionLimitations?: string[];
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request - support both GET with query params and POST with body
    let vehicleId: string;
    let period: string;
    let startDate: string | undefined;
    let endDate: string | undefined;
    let subscriptionTier: string;

    if (req.method === "GET") {
      const url = new URL(req.url);
      vehicleId = url.pathname.split('/').pop() || '';
      period = url.searchParams.get('period') || 'weekly';
      startDate = url.searchParams.get('startDate') || undefined;
      endDate = url.searchParams.get('endDate') || undefined;
      subscriptionTier = url.searchParams.get('subscriptionTier') || 'basic';
    } else {
      const body: FuelInsightsRequest = await req.json();
      vehicleId = body.vehicleId;
      period = body.period;
      startDate = body.startDate;
      endDate = body.endDate;
      subscriptionTier = body.subscriptionTier || 'basic';
    }

    // Validate required fields
    if (!vehicleId) {
      throw new Error("Vehicle ID is required");
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error("Invalid authentication");
    }

    console.log(`Fuel Insights API: Processing request for vehicle ${vehicleId}, period ${period}, user ${user.id}`);

    // Verify user has access to this vehicle
    const { data: vehicle, error: vehicleError } = await supabaseClient
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .eq('subscriber_id', user.id)
      .single();

    if (vehicleError || !vehicle) {
      throw new Error("Vehicle not found or access denied");
    }

    // Determine user's subscription tier
    const { data: userSubscription } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_packages(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const actualSubscriptionTier = userSubscription?.subscription_packages?.name?.toLowerCase() || 'basic';
    
    // Create date range based on period
    const { start, end } = createDateRange(period, startDate, endDate);

    // Get GPS51 fuel consumption data (this would integrate with your GPS51 service)
    const gps51FuelData = await fetchGPS51FuelData(vehicle.gps51_device_id, start, end);
    
    if (!gps51FuelData) {
      return new Response(JSON.stringify({
        success: false,
        error: "No fuel consumption data available for the specified period"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate comprehensive fuel insights
    const insights = await generateFuelInsights(
      supabaseClient,
      vehicle,
      gps51FuelData,
      { start, end, type: period },
      actualSubscriptionTier
    );

    // Apply subscription-based limitations
    const { limitedInsights, limitations } = applySubscriptionLimitations(insights, actualSubscriptionTier);

    // Store analytics for usage tracking
    await supabaseClient.from('api_calls_monitor').insert({
      endpoint: 'fuel-insights-api',
      method: req.method,
      request_payload: {
        vehicleId,
        period,
        subscriptionTier: actualSubscriptionTier
      },
      response_status: 200,
      response_body: {
        insightsGenerated: true,
        subscriptionTier: actualSubscriptionTier
      }
    });

    const response: FuelInsightsResponse = {
      success: true,
      insights: limitedInsights,
      subscriptionLimitations: limitations.length > 0 ? limitations : undefined
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Fuel insights API error:", error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

function createDateRange(period: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (period === 'custom' && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    switch (period) {
      case 'daily':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = new Date(now);
        break;
      case 'monthly':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        end = new Date(now);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = new Date(now);
    }
  }

  return { start, end };
}

async function fetchGPS51FuelData(deviceId: string, start: Date, end: Date) {
  // Mock GPS51 fuel data - in production, this would call GPS51 API
  // This would integrate with your existing GPS51FuelConsumptionService
  return {
    deviceId,
    deviceName: `Device ${deviceId}`,
    oilPer100km: 7.2,
    runOilPer100km: 7.5,
    totalDistance: 245.6,
    totalFuel: 18.3,
    averageSpeed: 65.4,
    reportDate: new Date().toISOString(),
    tripData: []
  };
}

async function generateFuelInsights(
  supabaseClient: any,
  vehicle: any,
  gps51Data: any,
  period: any,
  subscriptionTier: string
) {
  // Get manufacturer data for comparison
  let manufacturerData = null;
  if (vehicle.brand && vehicle.model && vehicle.year) {
    const { data } = await supabaseClient
      .from('manufacturer_fuel_data')
      .select('*')
      .ilike('brand', vehicle.brand)
      .ilike('model', vehicle.model)
      .eq('year', vehicle.year)
      .limit(1)
      .maybeSingle();
    
    manufacturerData = data;
  }

  // Calculate base insights
  const actualConsumption = {
    lPer100km: gps51Data.oilPer100km,
    totalFuelUsed: gps51Data.totalFuel,
    totalDistance: gps51Data.totalDistance,
    averageSpeed: gps51Data.averageSpeed,
    costEstimate: gps51Data.totalFuel * 1.50 // Default fuel price
  };

  const insights: any = {
    vehicleId: vehicle.id,
    deviceId: gps51Data.deviceId,
    period,
    actualConsumption,
    subscriptionTier,
    dataQuality: {
      completeness: 85,
      reliability: 'high',
      lastUpdated: new Date().toISOString()
    }
  };

  // Add manufacturer comparison if available
  if (manufacturerData) {
    const statedConsumption = manufacturerData.combined_consumption || manufacturerData.city_consumption || 8.0;
    const deviationPercentage = ((actualConsumption.lPer100km - statedConsumption) / statedConsumption) * 100;
    
    insights.manufacturerBenchmark = {
      statedConsumption,
      source: 'combined',
      confidence: 0.9
    };

    insights.comparison = {
      deviationPercentage: Math.round(deviationPercentage * 100) / 100,
      efficiencyRating: deviationPercentage <= 5 ? 'optimal' : deviationPercentage <= 20 ? 'above_expected' : 'high_consumption',
      explanation: `Your consumption is ${Math.abs(deviationPercentage).toFixed(1)}% ${deviationPercentage >= 0 ? 'above' : 'below'} manufacturer specifications.`,
      factors: []
    };
  }

  // Add premium features for higher tiers
  if (subscriptionTier !== 'basic') {
    insights.speedAnalysis = {
      avgSpeed: actualConsumption.averageSpeed,
      speedDistribution: {
        'city_0_50': actualConsumption.averageSpeed < 50 ? 100 : 0,
        'suburban_50_80': actualConsumption.averageSpeed >= 50 && actualConsumption.averageSpeed < 80 ? 100 : 0,
        'highway_80_120': actualConsumption.averageSpeed >= 80 ? 100 : 0,
        'high_speed_120_plus': 0
      },
      impactExplanation: `Average speed: ${actualConsumption.averageSpeed.toFixed(1)} km/h affects fuel efficiency.`
    };

    // Get historical trends for premium users
    const { data: historicalReports } = await supabaseClient
      .from('fuel_consumption_reports')
      .select('*')
      .eq('vehicle_id', vehicle.id)
      .order('report_period_end', { ascending: false })
      .limit(6);

    if (historicalReports && historicalReports.length > 0) {
      insights.historicalTrends = {
        previousPeriods: historicalReports.map((report: any) => ({
          period: report.report_period_start.slice(0, 10),
          consumption: report.actual_consumption,
          deviation: report.deviation_percentage
        })),
        trend: 'stable'
      };
    }
  }

  return insights;
}

function applySubscriptionLimitations(insights: any, subscriptionTier: string) {
  const limitations: string[] = [];
  const limitedInsights = { ...insights };

  if (subscriptionTier === 'basic') {
    // Remove premium features for basic users
    delete limitedInsights.speedAnalysis;
    delete limitedInsights.historicalTrends;
    
    limitations.push("Speed impact analysis available in Premium");
    limitations.push("Historical trends available in Premium");
    
    // Limit manufacturer comparison detail
    if (limitedInsights.comparison) {
      delete limitedInsights.comparison.factors;
      limitations.push("Detailed efficiency factors available in Premium");
    }
  }

  return { limitedInsights, limitations };
}

serve(handler);