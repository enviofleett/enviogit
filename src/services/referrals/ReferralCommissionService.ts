import { supabase } from '@/integrations/supabase/client';

export interface ReferralCommission {
  id: string;
  referring_agent_id: string;
  referred_user_id: string;
  commission_type: string;
  amount: number;
  percentage_applied: number;
  payout_status: string;
  source_entity_id: string | null;
  timestamp: string;
  created_at: string;
}

export interface CommissionSummary {
  totalCommissions: number;
  pendingCommissions: number;
  paidCommissions: number;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
}

export class ReferralCommissionService {
  
  /**
   * Get all commissions with agent and user details (Admin only)
   */
  static async getAllCommissions(): Promise<any[]> {
    const { data: commissions, error } = await supabase
      .from('commission_events')
      .select(`
        *,
        referring_agents (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commissions:', error);
      throw new Error(`Failed to fetch commissions: ${error.message}`);
    }

    return commissions || [];
  }

  /**
   * Get commissions for a specific agent
   */
  static async getAgentCommissions(agentId: string): Promise<ReferralCommission[]> {
    const { data: commissions, error } = await supabase
      .from('commission_events')
      .select('*')
      .eq('referring_agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agent commissions:', error);
      throw new Error(`Failed to fetch agent commissions: ${error.message}`);
    }

    return commissions || [];
  }

  /**
   * Get commission summary statistics
   */
  static async getCommissionSummary(): Promise<CommissionSummary> {
    const { data: commissions, error } = await supabase
      .from('commission_events')
      .select('*');

    if (error) {
      console.error('Error fetching commission summary:', error);
      throw new Error(`Failed to fetch commission summary: ${error.message}`);
    }

    const totalCommissions = commissions?.length || 0;
    const pendingCommissions = commissions?.filter(c => c.payout_status === 'pending').length || 0;
    const paidCommissions = commissions?.filter(c => c.payout_status === 'paid').length || 0;

    const totalAmount = commissions?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;
    const pendingAmount = commissions?.filter(c => c.payout_status === 'pending')
      .reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;
    const paidAmount = commissions?.filter(c => c.payout_status === 'paid')
      .reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

    return {
      totalCommissions,
      pendingCommissions,
      paidCommissions,
      totalAmount,
      pendingAmount,
      paidAmount
    };
  }

  /**
   * Get commissions with filters
   */
  static async getFilteredCommissions(filters: {
    agentId?: string;
    status?: string;
    commissionType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    let query = supabase
      .from('commission_events')
      .select(`
        *,
        referring_agents (
          id,
          name,
          email
        )
      `);

    if (filters.agentId) {
      query = query.eq('referring_agent_id', filters.agentId);
    }

    if (filters.status) {
      query = query.eq('payout_status', filters.status);
    }

    if (filters.commissionType) {
      query = query.eq('commission_type', filters.commissionType);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: commissions, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching filtered commissions:', error);
      throw new Error(`Failed to fetch commissions: ${error.message}`);
    }

    return commissions || [];
  }

  /**
   * Update commission payout status
   */
  static async updateCommissionStatus(commissionId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('commission_events')
      .update({ payout_status: status })
      .eq('id', commissionId);

    if (error) {
      console.error('Error updating commission status:', error);
      throw new Error(`Failed to update commission status: ${error.message}`);
    }

    console.log('Commission status updated successfully:', commissionId, status);
  }

  /**
   * Get commission rates
   */
  static async getCommissionRates(): Promise<any[]> {
    const { data: rates, error } = await supabase
      .from('referral_commission_rates')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching commission rates:', error);
      throw new Error(`Failed to fetch commission rates: ${error.message}`);
    }

    return rates || [];
  }

  /**
   * Update commission rates (Admin only)
   */
  static async updateCommissionRates(rates: {
    commission_type: string;
    percentage: number;
  }[]): Promise<void> {
    for (const rate of rates) {
      const { error } = await supabase
        .from('referral_commission_rates')
        .update({ percentage: rate.percentage })
        .eq('commission_type', rate.commission_type)
        .eq('is_active', true);

      if (error) {
        console.error('Error updating commission rate:', error);
        throw new Error(`Failed to update commission rate: ${error.message}`);
      }
    }

    console.log('Commission rates updated successfully');
  }

  /**
   * Get new sign-ups in the last 30 days
   */
  static async getRecentSignups(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('id')
      .gte('signup_timestamp', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error fetching recent signups:', error);
      throw new Error(`Failed to fetch recent signups: ${error.message}`);
    }

    return referrals?.length || 0;
  }
}