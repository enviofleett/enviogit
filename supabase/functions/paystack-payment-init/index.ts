import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentInitRequest {
  amount: number;
  currency?: string;
  email: string;
  description?: string;
  order_id?: string;
  subscription_plan_code?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  secret_pin?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      amount,
      currency = "NGN",
      email,
      description,
      order_id,
      subscription_plan_code,
      callback_url,
      metadata = {},
      secret_pin
    }: PaymentInitRequest = await req.json();

    console.log('Paystack Payment Init: Processing request', {
      amount,
      currency,
      email,
      hasOrderId: !!order_id,
      hasSubscriptionPlan: !!subscription_plan_code,
      hasSecretPin: !!secret_pin
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

    // Verify secret PIN if provided (for purchase confirmation)
    if (secret_pin) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('notes')
        .eq('id', user.id)
        .single();

      if (profile?.notes) {
        const profileData = JSON.parse(profile.notes);
        if (profileData.secret_pin !== secret_pin) {
          throw new Error("Invalid secret PIN");
        }
      } else {
        throw new Error("Secret PIN not set in profile");
      }
    }

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    // Generate unique reference
    const reference = `gps51_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare Paystack payload
    const paystackPayload = {
      email,
      amount: Math.round(amount * 100), // Convert to kobo/cents
      currency,
      reference,
      callback_url: callback_url || `${Deno.env.get("SUPABASE_URL")}/functions/v1/paystack-callback`,
      metadata: {
        user_id: user.id,
        order_id,
        subscription_plan_code,
        ...metadata
      }
    };

    // Handle subscription payments
    if (subscription_plan_code) {
      // For subscriptions, we need to create a subscription instead of a one-time payment
      const subscriptionPayload = {
        customer: email,
        plan: subscription_plan_code,
        authorization: "", // This will be handled by Paystack after initial payment
        start_date: new Date().toISOString()
      };

      console.log('Paystack Payment Init: Creating subscription', { subscription_plan_code });
    }

    console.log('Paystack Payment Init: Initializing transaction with Paystack', {
      reference,
      amount: paystackPayload.amount,
      email
    });

    // Initialize transaction with Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paystackPayload)
    });

    const paystackResult = await paystackResponse.json();

    if (!paystackResult.status) {
      console.error('Paystack Payment Init: Paystack API error', paystackResult);
      throw new Error(`Paystack error: ${paystackResult.message}`);
    }

    // Store transaction in our database
    const { error: dbError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        paystack_reference: reference,
        order_id,
        subscription_id: subscription_plan_code ? null : null, // Will be updated later
        amount: amount,
        currency,
        status: 'initiated',
        customer_email: email,
        customer_name: user.user_metadata?.name || email,
        description: description || `Payment for ${subscription_plan_code ? 'subscription' : 'order'}`,
        metadata: {
          paystack_access_code: paystackResult.data.access_code,
          order_id,
          subscription_plan_code,
          ...metadata
        }
      });

    if (dbError) {
      console.error('Paystack Payment Init: Database error', dbError);
      throw new Error('Failed to store transaction record');
    }

    const executionTime = Date.now() - startTime;

    console.log('Paystack Payment Init: Transaction initialized successfully', {
      reference,
      authorization_url: paystackResult.data.authorization_url,
      executionTime: `${executionTime}ms`
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        authorization_url: paystackResult.data.authorization_url,
        access_code: paystackResult.data.access_code,
        reference: reference
      },
      message: 'Payment initialization successful',
      executionTime
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Paystack Payment Init error:", error);
    
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