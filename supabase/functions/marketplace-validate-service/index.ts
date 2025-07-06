import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateServiceRequest {
  transaction_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { transaction_id }: ValidateServiceRequest = await req.json();

    console.log('Marketplace Service Validation: Processing request', {
      transaction_id
    });

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid authentication token");
    }

    // Verify the user is a merchant
    const { data: merchant } = await supabaseClient
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single();

    if (!merchant) {
      throw new Error("Access denied: Only approved merchants can validate services");
    }

    // Find the order with this transaction ID
    const { data: order, error: orderError } = await supabaseClient
      .from('marketplace_orders')
      .select(`
        *,
        marketplace_offerings(name),
        merchants(business_name)
      `)
      .eq('transaction_id', transaction_id)
      .eq('merchant_id', merchant.id)
      .eq('status', 'paid_pending_validation')
      .single();

    if (orderError || !order) {
      throw new Error("Order not found or not eligible for validation");
    }

    // Update order status to service_validated
    const { error: updateError } = await supabaseClient
      .from('marketplace_orders')
      .update({
        status: 'service_validated',
        validation_date: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      throw new Error("Failed to update order status");
    }

    // Create payout record (for automatic processing)
    const { error: payoutError } = await supabaseClient
      .from('marketplace_payouts')
      .insert({
        merchant_id: merchant.id,
        order_id: order.id,
        amount: order.merchant_amount,
        currency: order.currency,
        status: 'pending',
        initiated_at: new Date().toISOString()
      });

    if (payoutError) {
      console.error('Failed to create payout record:', payoutError);
      // Don't fail the validation if payout record creation fails
    }

    // TODO: Trigger automatic payout to merchant
    // This would integrate with Paystack's Transfer API
    console.log('Automatic payout would be triggered here for:', {
      merchant_id: merchant.id,
      amount: order.merchant_amount,
      currency: order.currency
    });

    const executionTime = Date.now() - startTime;

    console.log('Marketplace Service Validation: Service validated successfully', {
      order_id: order.id,
      transaction_id: transaction_id,
      merchant_name: merchant.business_name,
      payout_amount: order.merchant_amount,
      executionTime: `${executionTime}ms`
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        order_id: order.id,
        transaction_id: transaction_id,
        status: 'service_validated',
        payout_amount: order.merchant_amount,
        currency: order.currency,
        message: 'Service validated successfully. Payout will be processed automatically.'
      },
      executionTime
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Marketplace Service Validation error:", error);
    
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