import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

interface PaystackWebhookEvent {
  event: string;
  data: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Get webhook payload
    const payload = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    console.log('Paystack Webhook: Received event', {
      hasSignature: !!signature,
      payloadLength: payload.length,
      timestamp: new Date().toISOString()
    });

    if (!signature) {
      throw new Error("Missing Paystack signature");
    }

    // Verify webhook signature
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    const expectedSignature = await crypto.subtle.digest(
      "SHA-512",
      new TextEncoder().encode(payload + paystackSecretKey)
    );
    
    const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedSignatureHex) {
      console.error('Paystack Webhook: Invalid signature', {
        received: signature,
        expected: expectedSignatureHex
      });
      throw new Error("Invalid webhook signature");
    }

    const event: PaystackWebhookEvent = JSON.parse(payload);
    
    console.log('Paystack Webhook: Processing event', {
      eventType: event.event,
      reference: event.data?.reference,
      status: event.data?.status
    });

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Store webhook event for audit trail
    const eventId = event.data?.id || `${event.event}_${Date.now()}`;
    const { error: eventStoreError } = await supabaseClient
      .from('paystack_events')
      .insert({
        event_type: event.event,
        paystack_event_id: eventId,
        reference: event.data?.reference,
        data: event.data,
        signature_verified: true,
        processed: false
      });

    if (eventStoreError) {
      console.error('Paystack Webhook: Failed to store event', eventStoreError);
    }

    // Process different event types
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(supabaseClient, event.data);
        break;
      
      case 'subscription.create':
        await handleSubscriptionCreate(supabaseClient, event.data);
        break;
      
      case 'subscription.not_renew':
      case 'subscription.disable':
        await handleSubscriptionDisable(supabaseClient, event.data);
        break;
      
      case 'transfer.success':
        await handleTransferSuccess(supabaseClient, event.data);
        break;
      
      case 'transfer.failed':
        await handleTransferFailed(supabaseClient, event.data);
        break;
        
      default:
        console.log('Paystack Webhook: Unhandled event type', event.event);
    }

    // Mark event as processed
    await supabaseClient
      .from('paystack_events')
      .update({ 
        processed: true, 
        processed_at: new Date().toISOString() 
      })
      .eq('paystack_event_id', eventId);

    const executionTime = Date.now() - startTime;

    console.log('Paystack Webhook: Event processed successfully', {
      eventType: event.event,
      executionTime: `${executionTime}ms`
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook processed successfully',
      executionTime
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Paystack Webhook error:", error);
    
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

// Handle successful charge
async function handleChargeSuccess(supabaseClient: any, data: any) {
  console.log('Paystack Webhook: Processing charge success', {
    reference: data.reference,
    amount: data.amount,
    email: data.customer?.email
  });

  // Verify transaction with Paystack API
  const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${data.reference}`, {
    headers: {
      'Authorization': `Bearer ${paystackSecretKey}`
    }
  });

  const verifyResult = await verifyResponse.json();
  
  if (!verifyResult.status || verifyResult.data.status !== 'success') {
    throw new Error('Transaction verification failed');
  }

  // Update transaction in database
  const { error: updateError } = await supabaseClient
    .from('transactions')
    .update({
      paystack_transaction_id: data.id,
      status: 'success',
      payment_method: data.channel,
      verified_at: new Date().toISOString(),
      metadata: {
        ...data.metadata,
        gateway_response: data.gateway_response,
        channel: data.channel,
        fees: data.fees
      }
    })
    .eq('paystack_reference', data.reference);

  if (updateError) {
    console.error('Paystack Webhook: Failed to update transaction', updateError);
    throw updateError;
  }

  // Handle subscription activation if this is a subscription payment
  if (data.metadata?.subscription_plan_code) {
    await handleSubscriptionPayment(supabaseClient, data);
  }

  // Handle marketplace order completion
  if (data.metadata?.order_id) {
    await handleMarketplacePayment(supabaseClient, data);
  }

  console.log('Paystack Webhook: Charge success processed', {
    reference: data.reference,
    transactionId: data.id
  });
}

// Handle subscription creation
async function handleSubscriptionCreate(supabaseClient: any, data: any) {
  console.log('Paystack Webhook: Processing subscription creation', {
    subscriptionCode: data.subscription_code,
    customerEmail: data.customer?.email
  });

  // Update user subscription with Paystack details
  const { error: subscriptionError } = await supabaseClient
    .from('user_subscriptions')
    .update({
      paystack_subscription_id: data.id,
      paystack_subscription_code: data.subscription_code,
      payment_status: 'active',
      last_payment_date: new Date().toISOString(),
      next_payment_date: data.next_payment_date
    })
    .eq('user_id', data.customer?.metadata?.user_id);

  if (subscriptionError) {
    console.error('Paystack Webhook: Failed to update subscription', subscriptionError);
    throw subscriptionError;
  }
}

// Handle subscription payment (for existing subscriptions)
async function handleSubscriptionPayment(supabaseClient: any, data: any) {
  const userId = data.metadata?.user_id;
  const planCode = data.metadata?.subscription_plan_code;

  if (!userId || !planCode) {
    console.warn('Paystack Webhook: Missing user ID or plan code for subscription payment');
    return;
  }

  // Get the subscription plan details
  const { data: plan } = await supabaseClient
    .from('paystack_plans')
    .select('*')
    .eq('paystack_plan_code', planCode)
    .single();

  if (!plan) {
    console.warn('Paystack Webhook: Plan not found', { planCode });
    return;
  }

  // Calculate next payment date based on interval
  const nextPaymentDate = new Date();
  switch (plan.interval) {
    case 'monthly':
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 3);
      break;
    case 'annually':
      nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
      break;
  }

  // Update or create user subscription
  const { error: upsertError } = await supabaseClient
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      package_id: plan.id,
      status: 'active',
      payment_status: 'active',
      last_payment_date: new Date().toISOString(),
      next_payment_date: nextPaymentDate.toISOString()
    });

  if (upsertError) {
    console.error('Paystack Webhook: Failed to upsert subscription', upsertError);
    throw upsertError;
  }
}

// Handle marketplace payment completion
async function handleMarketplacePayment(supabaseClient: any, data: any) {
  const orderId = data.metadata?.order_id;
  
  if (!orderId) {
    console.warn('Paystack Webhook: Missing order ID for marketplace payment');
    return;
  }

  // Update order status to paid_pending_validation
  // This would typically update an orders table (not implemented in this schema yet)
  console.log('Paystack Webhook: Marketplace payment completed', {
    orderId,
    amount: data.amount / 100 // Convert from kobo to naira
  });

  // Trigger merchant notification
  // This would typically send email/SMS to merchant about new payment
}

// Handle subscription disable/non-renewal
async function handleSubscriptionDisable(supabaseClient: any, data: any) {
  console.log('Paystack Webhook: Processing subscription disable', {
    subscriptionCode: data.subscription_code
  });

  const { error: updateError } = await supabaseClient
    .from('user_subscriptions')
    .update({
      payment_status: 'cancelled',
      status: 'cancelled'
    })
    .eq('paystack_subscription_code', data.subscription_code);

  if (updateError) {
    console.error('Paystack Webhook: Failed to disable subscription', updateError);
    throw updateError;
  }
}

// Handle successful transfer (payout)
async function handleTransferSuccess(supabaseClient: any, data: any) {
  console.log('Paystack Webhook: Processing transfer success', {
    transferCode: data.transfer_code,
    amount: data.amount
  });

  const { error: updateError } = await supabaseClient
    .from('merchant_payouts')
    .update({
      paystack_transfer_id: data.id,
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('transfer_code', data.transfer_code);

  if (updateError) {
    console.error('Paystack Webhook: Failed to update payout', updateError);
    throw updateError;
  }
}

// Handle failed transfer (payout)
async function handleTransferFailed(supabaseClient: any, data: any) {
  console.log('Paystack Webhook: Processing transfer failure', {
    transferCode: data.transfer_code,
    failureReason: data.failure_reason
  });

  const { error: updateError } = await supabaseClient
    .from('merchant_payouts')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: data.failure_reason
    })
    .eq('transfer_code', data.transfer_code);

  if (updateError) {
    console.error('Paystack Webhook: Failed to update failed payout', updateError);
    throw updateError;
  }
}

serve(handler);