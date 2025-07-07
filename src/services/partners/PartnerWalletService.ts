import { supabase } from '@/integrations/supabase/client';

export interface PartnerWallet {
  id: string;
  technical_partner_id: string;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  transaction_type: 'topup' | 'debit' | 'earnings' | 'payout';
  amount: number;
  reference?: string;
  description?: string;
  metadata: any;
  created_at: string;
}

export interface PartnerEarning {
  id: string;
  technical_partner_id: string;
  user_subscription_id?: string;
  earning_type: 'upgrade' | 'renewal' | 'activation';
  amount_earned: number;
  commission_percentage: number;
  base_amount: number;
  payout_status: 'pending' | 'approved' | 'paid';
  created_at: string;
}

export interface PayoutRequest {
  id: string;
  technical_partner_id: string;
  amount: number;
  requested_at: string;
  approved_at?: string;
  approved_by?: string;
  paid_at?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  bank_account_details: any;
  failure_reason?: string;
}

export class PartnerWalletService {
  
  /**
   * Get partner wallet information
   */
  static async getPartnerWallet(partnerId: string): Promise<PartnerWallet | null> {
    const { data: wallet, error } = await supabase
      .from('partner_wallets')
      .select('*')
      .eq('technical_partner_id', partnerId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching partner wallet:', error);
      throw new Error(`Failed to fetch wallet: ${error.message}`);
    }

    return wallet;
  }

  /**
   * Get wallet transaction history
   */
  static async getWalletTransactions(walletId: string, limit: number = 50): Promise<WalletTransaction[]> {
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching wallet transactions:', error);
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    return (transactions || []) as WalletTransaction[];
  }

  /**
   * Get partner earnings
   */
  static async getPartnerEarnings(partnerId: string): Promise<PartnerEarning[]> {
    const { data: earnings, error } = await supabase
      .from('partner_earnings')
      .select(`
        *,
        user_subscriptions (
          id,
          profiles:user_id (
            name
          ),
          subscription_packages (
            name
          )
        )
      `)
      .eq('technical_partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching partner earnings:', error);
      throw new Error(`Failed to fetch earnings: ${error.message}`);
    }

    return (earnings || []) as PartnerEarning[];
  }

  /**
   * Initiate wallet top-up via Paystack
   */
  static async initiateWalletTopup(partnerId: string, amount: number): Promise<{ payment_url: string; transaction_id: string }> {
    try {
      console.log('Initiating wallet top-up:', { partnerId, amount });

      const { data: result, error } = await supabase.functions.invoke('paystack-payment-init', {
        body: {
          amount: amount * 100, // Convert to kobo for Paystack
          email: '', // Will be filled by the edge function
          metadata: {
            type: 'partner_wallet_topup',
            technical_partner_id: partnerId,
            amount: amount
          }
        }
      });

      if (error) {
        console.error('Error initiating wallet top-up:', error);
        throw new Error(`Failed to initiate payment: ${error.message}`);
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Payment initialization failed');
      }

      console.log('Wallet top-up initiated successfully:', result.data.reference);
      return {
        payment_url: result.data.authorization_url,
        transaction_id: result.data.reference
      };
    } catch (error) {
      console.error('Error in wallet top-up:', error);
      throw error;
    }
  }

  /**
   * Debit wallet for activation fees or other charges
   */
  static async debitWallet(partnerId: string, amount: number, description: string, reference?: string): Promise<void> {
    try {
      console.log('Debiting partner wallet:', { partnerId, amount, description });

      const { data, error } = await supabase.functions.invoke('partner-wallet-operation', {
        body: {
          operation: 'debit',
          technical_partner_id: partnerId,
          amount,
          description,
          reference
        }
      });

      if (error) {
        console.error('Error debiting wallet:', error);
        throw new Error(`Failed to debit wallet: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Wallet debit failed');
      }

      console.log('Wallet debited successfully');
    } catch (error) {
      console.error('Error in wallet debit:', error);
      throw error;
    }
  }

  /**
   * Credit wallet with earnings
   */
  static async creditWalletEarnings(partnerId: string, amount: number, description: string, metadata?: any): Promise<void> {
    try {
      console.log('Crediting partner wallet with earnings:', { partnerId, amount, description });

      const { data, error } = await supabase.functions.invoke('partner-wallet-operation', {
        body: {
          operation: 'credit_earnings',
          technical_partner_id: partnerId,
          amount,
          description,
          metadata
        }
      });

      if (error) {
        console.error('Error crediting wallet earnings:', error);
        throw new Error(`Failed to credit earnings: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Wallet credit failed');
      }

      console.log('Wallet credited with earnings successfully');
    } catch (error) {
      console.error('Error in wallet earnings credit:', error);
      throw error;
    }
  }

  /**
   * Request payout
   */
  static async requestPayout(partnerId: string, amount: number, bankAccountDetails: any): Promise<PayoutRequest> {
    const { data: payoutRequest, error } = await supabase
      .from('partner_payout_requests')
      .insert({
        technical_partner_id: partnerId,
        amount,
        bank_account_details: bankAccountDetails,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error requesting payout:', error);
      throw new Error(`Failed to request payout: ${error.message}`);
    }

    console.log('Payout requested successfully:', payoutRequest.id);
    return payoutRequest as PayoutRequest;
  }

  /**
   * Get payout requests for a partner
   */
  static async getPayoutRequests(partnerId: string): Promise<PayoutRequest[]> {
    const { data: requests, error } = await supabase
      .from('partner_payout_requests')
      .select('*')
      .eq('technical_partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payout requests:', error);
      throw new Error(`Failed to fetch payout requests: ${error.message}`);
    }

    return (requests || []) as PayoutRequest[];
  }

  /**
   * Admin: Get all payout requests
   */
  static async getAllPayoutRequests(): Promise<PayoutRequest[]> {
    const { data: requests, error } = await supabase
      .from('partner_payout_requests')
      .select(`
        *,
        technical_partners (
          name,
          email,
          phone_number
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all payout requests:', error);
      throw new Error(`Failed to fetch payout requests: ${error.message}`);
    }

    return (requests || []) as PayoutRequest[];
  }

  /**
   * Admin: Approve payout request
   */
  static async approvePayoutRequest(requestId: string, adminId: string): Promise<void> {
    try {
      console.log('Approving payout request:', requestId);

      const { data, error } = await supabase.functions.invoke('partner-payout-approve', {
        body: {
          payout_request_id: requestId,
          admin_id: adminId
        }
      });

      if (error) {
        console.error('Error approving payout:', error);
        throw new Error(`Failed to approve payout: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Payout approval failed');
      }

      console.log('Payout approved and processed successfully');
    } catch (error) {
      console.error('Error in payout approval:', error);
      throw error;
    }
  }

  /**
   * Get all partner wallets (Admin only)
   */
  static async getAllWallets(): Promise<any[]> {
    const { data: wallets, error } = await supabase
      .from('partner_wallets')
      .select(`
        *,
        technical_partners (
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all wallets:', error);
      throw new Error(`Failed to fetch wallets: ${error.message}`);
    }

    return wallets || [];
  }

  /**
   * Get wallet summary statistics (Admin only)
   */
  static async getWalletSummary(): Promise<any> {
    const { data: wallets, error } = await supabase
      .from('partner_wallets')
      .select('current_balance');

    if (error) {
      console.error('Error fetching wallet summary:', error);
      throw new Error(`Failed to fetch wallet summary: ${error.message}`);
    }

    const totalBalance = wallets?.reduce((sum, wallet) => sum + parseFloat(wallet.current_balance.toString()), 0) || 0;

    // Get monthly earnings (simplified calculation)
    const { data: earnings, error: earningsError } = await supabase
      .from('partner_earnings')
      .select('amount_earned')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

    const monthlyEarnings = earnings?.reduce((sum, earning) => sum + parseFloat(earning.amount_earned.toString()), 0) || 0;

    return {
      totalBalance,
      monthlyEarnings,
      totalPayouts: 0 // TODO: Calculate from payout history
    };
  }

  /**
   * Reject a payout request (Admin only)
   */
  static async rejectPayoutRequest(requestId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('partner_payout_requests')
      .update({ 
        status: 'rejected',
        failure_reason: reason,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (error) {
      console.error('Error rejecting payout request:', error);
      throw new Error(`Failed to reject payout request: ${error.message}`);
    }

    console.log('Payout request rejected successfully');
  }
}