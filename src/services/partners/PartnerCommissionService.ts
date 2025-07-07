import { supabase } from '@/integrations/supabase/client';

export interface CommissionRate {
  id: string;
  subscription_package_id: string;
  upgrade_commission_percentage: number;
  renewal_commission_percentage: number;
  activation_commission_percentage: number;
  is_active: boolean;
}

export interface CommissionCalculation {
  partnerId: string;
  baseAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  earningType: 'upgrade' | 'renewal' | 'activation';
}

export class PartnerCommissionService {
  
  /**
   * Get commission rates for all subscription packages
   */
  static async getCommissionRates(): Promise<CommissionRate[]> {
    const { data: rates, error } = await supabase
      .from('commission_rates')
      .select(`
        *,
        subscription_packages (
          id,
          name,
          description
        )
      `)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching commission rates:', error);
      throw new Error(`Failed to fetch commission rates: ${error.message}`);
    }

    return rates || [];
  }

  /**
   * Calculate commission for a subscription event
   */
  static async calculateCommission(
    subscriptionId: string, 
    amount: number, 
    eventType: 'upgrade' | 'renewal' | 'activation'
  ): Promise<CommissionCalculation | null> {
    try {
      console.log('Calculating commission:', { subscriptionId, amount, eventType });

      // Get subscription details with partner info
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          profiles:user_id (
            id
          ),
          subscription_packages (
            id,
            name
          )
        `)
        .eq('id', subscriptionId)
        .single();

      if (subError || !subscription) {
        console.error('Error fetching subscription:', subError);
        return null;
      }

      // Check if this user was registered by a technical partner
      const { data: partnerUser, error: partnerError } = await supabase
        .from('partner_users')
        .select(`
          technical_partner_id,
          technical_partners (
            id,
            status
          )
        `)
        .eq('user_id', subscription.user_id)
        .maybeSingle();

      if (partnerError) {
        console.error('Error checking partner user:', partnerError);
        return null;
      }

      if (!partnerUser || partnerUser.technical_partners?.status !== 'approved') {
        console.log('User not registered by approved partner, no commission applicable');
        return null;
      }

      // Get commission rate for this subscription package
      const { data: commissionRate, error: rateError } = await supabase
        .from('commission_rates')
        .select('*')
        .eq('subscription_package_id', subscription.package_id)
        .eq('is_active', true)
        .maybeSingle();

      if (rateError || !commissionRate) {
        console.error('Error fetching commission rate:', rateError);
        return null;
      }

      // Calculate commission based on event type
      let commissionPercentage = 0;
      switch (eventType) {
        case 'upgrade':
          commissionPercentage = commissionRate.upgrade_commission_percentage;
          break;
        case 'renewal':
          commissionPercentage = commissionRate.renewal_commission_percentage;
          break;
        case 'activation':
          commissionPercentage = commissionRate.activation_commission_percentage;
          break;
      }

      const commissionAmount = (amount * commissionPercentage) / 100;

      console.log('Commission calculated:', {
        partnerId: partnerUser.technical_partner_id,
        baseAmount: amount,
        commissionPercentage,
        commissionAmount,
        earningType: eventType
      });

      return {
        partnerId: partnerUser.technical_partner_id,
        baseAmount: amount,
        commissionPercentage,
        commissionAmount,
        earningType: eventType
      };
    } catch (error) {
      console.error('Error calculating commission:', error);
      return null;
    }
  }

  /**
   * Record partner earning
   */
  static async recordPartnerEarning(
    calculation: CommissionCalculation,
    subscriptionId?: string
  ): Promise<void> {
    try {
      console.log('Recording partner earning:', calculation);

      // Insert partner earning record
      const { error: earningError } = await supabase
        .from('partner_earnings')
        .insert({
          technical_partner_id: calculation.partnerId,
          user_subscription_id: subscriptionId,
          earning_type: calculation.earningType,
          amount_earned: calculation.commissionAmount,
          commission_percentage: calculation.commissionPercentage,
          base_amount: calculation.baseAmount,
          payout_status: 'pending'
        });

      if (earningError) {
        console.error('Error recording partner earning:', earningError);
        throw new Error(`Failed to record earning: ${earningError.message}`);
      }

      // Credit partner wallet
      const { error: creditError } = await supabase.functions.invoke('partner-wallet-operation', {
        body: {
          operation: 'credit_earnings',
          technical_partner_id: calculation.partnerId,
          amount: calculation.commissionAmount,
          description: `${calculation.earningType} commission`,
          metadata: {
            earning_type: calculation.earningType,
            commission_percentage: calculation.commissionPercentage,
            base_amount: calculation.baseAmount
          }
        }
      });

      if (creditError) {
        console.error('Error crediting wallet:', creditError);
        // Don't throw here as the earning is already recorded
      }

      console.log('Partner earning recorded and wallet credited successfully');
    } catch (error) {
      console.error('Error recording partner earning:', error);
      throw error;
    }
  }

  /**
   * Admin: Update commission rates
   */
  static async updateCommissionRates(
    packageId: string, 
    rates: {
      upgrade_commission_percentage: number;
      renewal_commission_percentage: number;
      activation_commission_percentage: number;
    }
  ): Promise<CommissionRate> {
    const { data: commissionRate, error } = await supabase
      .from('commission_rates')
      .update(rates)
      .eq('subscription_package_id', packageId)
      .select()
      .single();

    if (error) {
      console.error('Error updating commission rates:', error);
      throw new Error(`Failed to update commission rates: ${error.message}`);
    }

    console.log('Commission rates updated successfully:', packageId);
    return commissionRate;
  }

  /**
   * Get partner earnings summary
   */
  static async getPartnerEarningsSummary(partnerId: string): Promise<{
    totalEarnings: number;
    pendingPayout: number;
    thisMonthEarnings: number;
    earningsByType: Record<string, number>;
  }> {
    const { data: earnings, error } = await supabase
      .from('partner_earnings')
      .select('*')
      .eq('technical_partner_id', partnerId);

    if (error) {
      console.error('Error fetching earnings summary:', error);
      throw new Error(`Failed to fetch earnings summary: ${error.message}`);
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const summary = {
      totalEarnings: 0,
      pendingPayout: 0,
      thisMonthEarnings: 0,
      earningsByType: {
        upgrade: 0,
        renewal: 0,
        activation: 0
      }
    };

    earnings?.forEach(earning => {
      const earningDate = new Date(earning.created_at);
      const amount = parseFloat(earning.amount_earned.toString());

      summary.totalEarnings += amount;
      
      if (earning.payout_status === 'pending') {
        summary.pendingPayout += amount;
      }

      if (earningDate.getMonth() === currentMonth && earningDate.getFullYear() === currentYear) {
        summary.thisMonthEarnings += amount;
      }

      summary.earningsByType[earning.earning_type] += amount;
    });

    return summary;
  }
}