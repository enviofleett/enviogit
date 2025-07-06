import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateOrderRequest {
  offering_id: string;
  vehicle_device_id: string;
  customer_pin: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      offering_id,
      vehicle_device_id,
      customer_pin
    }: CreateOrderRequest = await req.json();

    console.log('Marketplace Order Creation: Processing request', {
      offering_id,
      vehicle_device_id,
      hasPinProvided: !!customer_pin
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

    // Verify customer PIN
    const { data: userPin } = await supabaseClient
      .from('user_pins')
      .select('pin_hash, salt')
      .eq('user_id', user.id)
      .single();

    if (!userPin) {
      throw new Error("Please set up your security PIN in settings first");
    }

    // Here you would verify the PIN hash (simplified for demo)
    // In production, use proper cryptographic hashing
    console.log('PIN verification would happen here');

    // Get the offering details
    const { data: offering, error: offeringError } = await supabaseClient
      .from('marketplace_offerings')
      .select(`
        *,
        merchants(id, business_name, business_email)
      `)
      .eq('id', offering_id)
      .eq('is_active', true)
      .single();

    if (offeringError || !offering) {
      throw new Error("Offering not found or inactive");
    }

    // Calculate platform fee (configurable - default 5%)
    const platformFeeRate = 0.05;
    const platformFee = offering.price * platformFeeRate;
    const merchantAmount = offering.price - platformFee;

    // Generate unique transaction ID
    const transactionId = `mkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create marketplace order
    const { data: order, error: orderError } = await supabaseClient
      .from('marketplace_orders')
      .insert({
        customer_id: user.id,
        merchant_id: offering.merchant_id,
        offering_id: offering_id,
        vehicle_device_id: vehicle_device_id,
        transaction_id: transactionId,
        amount: offering.price,
        currency: offering.currency,
        platform_fee: platformFee,
        merchant_amount: merchantAmount,
        status: 'pending_payment',
        customer_contact_info: {
          email: user.email,
          user_id: user.id
        },
        service_details: {
          offering_name: offering.name,
          pricing_model: offering.pricing_model
        }
      })
      .select()
      .single();

    if (orderError) {
      console.error('Marketplace Order Creation: Database error', orderError);
      throw new Error('Failed to create order record');
    }

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Payment system not configured');
    }

    // Generate unique reference for Paystack
    const paystackReference = `${transactionId}_pay`;

    // Create Paystack payment
    const paystackPayload = {
      email: user.email,
      amount: Math.round(offering.price * 100), // Convert to kobo
      currency: offering.currency,
      reference: paystackReference,
      callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/paystack-callback`,
      metadata: {
        user_id: user.id,
        order_id: order.id,
        transaction_id: transactionId,
        vehicle_device_id: vehicle_device_id,
        offering_name: offering.name,
        merchant_name: offering.merchants?.business_name
      }
    };

    console.log('Marketplace Order Creation: Initializing Paystack payment', {
      reference: paystackReference,
      amount: paystackPayload.amount,
      email: user.email
    });

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
      console.error('Marketplace Order Creation: Paystack API error', paystackResult);
      throw new Error(`Payment initialization failed: ${paystackResult.message}`);
    }

    // Update order with Paystack reference
    await supabaseClient
      .from('marketplace_orders')
      .update({ paystack_reference: paystackReference })
      .eq('id', order.id);

    const executionTime = Date.now() - startTime;

    console.log('Marketplace Order Creation: Order created successfully', {
      order_id: order.id,
      transaction_id: transactionId,
      payment_url: paystackResult.data.authorization_url,
      executionTime: `${executionTime}ms`
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        order_id: order.id,
        transaction_id: transactionId,
        payment_url: paystackResult.data.authorization_url,
        amount: offering.price,
        currency: offering.currency,
        offering_name: offering.name,
        merchant_name: offering.merchants?.business_name
      },
      message: 'Order created successfully',
      executionTime
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Marketplace Order Creation error:", error);
    
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