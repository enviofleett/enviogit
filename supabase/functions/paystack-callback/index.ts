import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const reference = url.searchParams.get('reference');
  const status = url.searchParams.get('status');

  console.log('Paystack Callback: Processing callback', {
    reference,
    status,
    timestamp: new Date().toISOString()
  });

  try {
    if (!reference) {
      throw new Error('Missing payment reference');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get transaction from database
    const { data: transaction, error: fetchError } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('paystack_reference', reference)
      .single();

    if (fetchError || !transaction) {
      console.error('Paystack Callback: Transaction not found', { reference, fetchError });
      
      // Redirect to failure page
      return Response.redirect(
        `${Deno.env.get("SUPABASE_URL")}/payment-failed?error=transaction_not_found&reference=${reference}`,
        302
      );
    }

    // Only verify if status is success and transaction is not already verified
    if (status === 'success' && transaction.status === 'initiated') {
      console.log('Paystack Callback: Verifying successful transaction', { reference });

      // Verify transaction with Paystack
      const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!paystackSecretKey) {
        throw new Error('Paystack secret key not configured');
      }

      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`
        }
      });

      const verifyResult = await verifyResponse.json();

      if (verifyResult.status && verifyResult.data.status === 'success') {
        // Update transaction as successful
        const { error: updateError } = await supabaseClient
          .from('transactions')
          .update({
            paystack_transaction_id: verifyResult.data.id,
            status: 'success',
            payment_method: verifyResult.data.channel,
            verified_at: new Date().toISOString(),
            metadata: {
              ...transaction.metadata,
              gateway_response: verifyResult.data.gateway_response,
              channel: verifyResult.data.channel,
              fees: verifyResult.data.fees,
              paid_at: verifyResult.data.paid_at
            }
          })
          .eq('paystack_reference', reference);

        if (updateError) {
          console.error('Paystack Callback: Failed to update transaction', updateError);
        } else {
          console.log('Paystack Callback: Transaction verified and updated', { reference });
        }

        // Handle subscription activation
        if (transaction.metadata?.subscription_plan_code) {
          await handleSubscriptionActivation(supabaseClient, transaction, verifyResult.data);
        }

        // Redirect to success page
        return Response.redirect(
          `${Deno.env.get("SUPABASE_URL")}/payment-success?reference=${reference}&amount=${transaction.amount}`,
          302
        );
      } else {
        console.error('Paystack Callback: Transaction verification failed', verifyResult);
        
        // Update transaction as failed
        await supabaseClient
          .from('transactions')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString()
          })
          .eq('paystack_reference', reference);

        // Redirect to failure page
        return Response.redirect(
          `${Deno.env.get("SUPABASE_URL")}/payment-failed?error=verification_failed&reference=${reference}`,
          302
        );
      }
    } else if (status === 'cancelled') {
      console.log('Paystack Callback: Payment cancelled', { reference });
      
      // Update transaction as cancelled
      await supabaseClient
        .from('transactions')
        .update({
          status: 'cancelled'
        })
        .eq('paystack_reference', reference);

      // Redirect to cancelled page
      return Response.redirect(
        `${Deno.env.get("SUPABASE_URL")}/payment-cancelled?reference=${reference}`,
        302
      );
    } else {
      // For other statuses or already processed transactions
      console.log('Paystack Callback: Transaction already processed or unknown status', { 
        reference, 
        status, 
        transactionStatus: transaction.status 
      });

      // Redirect based on current transaction status
      if (transaction.status === 'success') {
        return Response.redirect(
          `${Deno.env.get("SUPABASE_URL")}/payment-success?reference=${reference}&amount=${transaction.amount}`,
          302
        );
      } else {
        return Response.redirect(
          `${Deno.env.get("SUPABASE_URL")}/payment-status?reference=${reference}`,
          302
        );
      }
    }

  } catch (error: any) {
    console.error("Paystack Callback error:", error);
    
    const executionTime = Date.now() - startTime;

    // Redirect to error page
    return Response.redirect(
      `${Deno.env.get("SUPABASE_URL")}/payment-error?error=${encodeURIComponent(error.message)}&reference=${reference || 'unknown'}`,
      302
    );
  }
};

// Handle subscription activation after successful payment
async function handleSubscriptionActivation(supabaseClient: any, transaction: any, paystackData: any) {
  const userId = transaction.user_id;
  const planCode = transaction.metadata?.subscription_plan_code;

  if (!userId || !planCode) {
    console.warn('Paystack Callback: Missing user ID or plan code for subscription');
    return;
  }

  try {
    // Get plan details
    const { data: plan } = await supabaseClient
      .from('paystack_plans')
      .select('*')
      .eq('paystack_plan_code', planCode)
      .single();

    if (!plan) {
      console.error('Paystack Callback: Plan not found', { planCode });
      return;
    }

    // Calculate next payment date
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

    // Create or update user subscription
    const { error: subscriptionError } = await supabaseClient
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        package_id: plan.id,
        status: 'active',
        payment_status: 'active',
        last_payment_date: new Date().toISOString(),
        next_payment_date: nextPaymentDate.toISOString(),
        subscription_end_date: nextPaymentDate.toISOString()
      });

    if (subscriptionError) {
      console.error('Paystack Callback: Failed to create/update subscription', subscriptionError);
    } else {
      console.log('Paystack Callback: Subscription activated successfully', {
        userId,
        planCode,
        nextPaymentDate: nextPaymentDate.toISOString()
      });
    }

  } catch (error) {
    console.error('Paystack Callback: Error in subscription activation', error);
  }
}

serve(handler);