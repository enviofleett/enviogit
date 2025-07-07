import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSecurity, PRODUCTION_SECURITY_CONFIG } from "../_shared/security.ts";

interface WalletOperationRequest {
  operation: 'debit' | 'credit_earnings' | 'credit_topup';
  technical_partner_id: string;
  amount: number;
  description: string;
  reference?: string;
  metadata?: any;
}

const secureHandler = async (req: Request): Promise<Response> => {
  try {
    const body: WalletOperationRequest = await req.json();
    const { operation, technical_partner_id, amount, description, reference, metadata } = body;

    if (!operation || !technical_partner_id || !amount || !description) {
      throw new Error('Missing required fields: operation, technical_partner_id, amount, description');
    }

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (operation) {
      case 'debit':
        return await handleWalletDebit(supabaseClient, technical_partner_id, amount, description, reference);
      case 'credit_earnings':
        return await handleWalletCreditEarnings(supabaseClient, technical_partner_id, amount, description, metadata);
      case 'credit_topup':
        return await handleWalletCreditTopup(supabaseClient, technical_partner_id, amount, description, reference);
      default:
        throw new Error('Invalid operation type');
    }
  } catch (error: any) {
    console.error("Wallet Operation Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      success: false 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

async function handleWalletDebit(supabaseClient: any, partnerId: string, amount: number, description: string, reference?: string) {
  console.log('Processing wallet debit:', { partnerId, amount, description });

  // Get partner wallet
  const { data: wallet, error: walletError } = await supabaseClient
    .from('partner_wallets')
    .select('*')
    .eq('technical_partner_id', partnerId)
    .single();

  if (walletError || !wallet) {
    throw new Error('Partner wallet not found');
  }

  const currentBalance = parseFloat(wallet.current_balance.toString());
  if (currentBalance < amount) {
    throw new Error(`Insufficient wallet balance. Current: ₦${currentBalance.toFixed(2)}, Required: ₦${amount.toFixed(2)}`);
  }

  const newBalance = currentBalance - amount;

  // Update wallet balance
  const { error: updateError } = await supabaseClient
    .from('partner_wallets')
    .update({ current_balance: newBalance })
    .eq('id', wallet.id);

  if (updateError) {
    throw new Error(`Failed to update wallet balance: ${updateError.message}`);
  }

  // Record transaction
  const { error: transactionError } = await supabaseClient
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      transaction_type: 'debit',
      amount: -amount, // Negative for debit
      reference,
      description,
      metadata: { operation: 'debit' }
    });

  if (transactionError) {
    console.error('Failed to record transaction:', transactionError);
    // Don't throw here as the wallet update was successful
  }

  console.log('Wallet debit successful:', { partnerId, amount, newBalance });

  return new Response(JSON.stringify({
    success: true,
    message: 'Wallet debited successfully',
    new_balance: newBalance,
    amount_debited: amount
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleWalletCreditEarnings(supabaseClient: any, partnerId: string, amount: number, description: string, metadata?: any) {
  console.log('Processing wallet credit for earnings:', { partnerId, amount, description });

  // Get partner wallet
  const { data: wallet, error: walletError } = await supabaseClient
    .from('partner_wallets')
    .select('*')
    .eq('technical_partner_id', partnerId)
    .single();

  if (walletError || !wallet) {
    throw new Error('Partner wallet not found');
  }

  const currentBalance = parseFloat(wallet.current_balance.toString());
  const newBalance = currentBalance + amount;

  // Update wallet balance
  const { error: updateError } = await supabaseClient
    .from('partner_wallets')
    .update({ current_balance: newBalance })
    .eq('id', wallet.id);

  if (updateError) {
    throw new Error(`Failed to update wallet balance: ${updateError.message}`);
  }

  // Record transaction
  const { error: transactionError } = await supabaseClient
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      transaction_type: 'earnings',
      amount,
      description,
      metadata: { operation: 'credit_earnings', ...metadata }
    });

  if (transactionError) {
    console.error('Failed to record transaction:', transactionError);
    // Don't throw here as the wallet update was successful
  }

  console.log('Wallet credit (earnings) successful:', { partnerId, amount, newBalance });

  return new Response(JSON.stringify({
    success: true,
    message: 'Earnings credited to wallet successfully',
    new_balance: newBalance,
    amount_credited: amount
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleWalletCreditTopup(supabaseClient: any, partnerId: string, amount: number, description: string, reference?: string) {
  console.log('Processing wallet credit for topup:', { partnerId, amount, description });

  // Get partner wallet
  const { data: wallet, error: walletError } = await supabaseClient
    .from('partner_wallets')
    .select('*')
    .eq('technical_partner_id', partnerId)
    .single();

  if (walletError || !wallet) {
    throw new Error('Partner wallet not found');
  }

  const currentBalance = parseFloat(wallet.current_balance.toString());
  const newBalance = currentBalance + amount;

  // Update wallet balance
  const { error: updateError } = await supabaseClient
    .from('partner_wallets')
    .update({ current_balance: newBalance })
    .eq('id', wallet.id);

  if (updateError) {
    throw new Error(`Failed to update wallet balance: ${updateError.message}`);
  }

  // Record transaction
  const { error: transactionError } = await supabaseClient
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      transaction_type: 'topup',
      amount,
      reference,
      description,
      metadata: { operation: 'credit_topup' }
    });

  if (transactionError) {
    console.error('Failed to record transaction:', transactionError);
    // Don't throw here as the wallet update was successful
  }

  console.log('Wallet credit (topup) successful:', { partnerId, amount, newBalance });

  return new Response(JSON.stringify({
    success: true,
    message: 'Wallet topped up successfully',
    new_balance: newBalance,
    amount_credited: amount
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

const handler = withSecurity(secureHandler, {
  rateLimit: PRODUCTION_SECURITY_CONFIG.rateLimits.default,
  requireSignature: false
});

serve(handler);