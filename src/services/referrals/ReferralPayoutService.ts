import { supabase } from '@/integrations/supabase/client';

export interface PayoutRequest {
  id: string;
  agent_id: string;
  amount: number;
  status: string;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paystack_transfer_code: string | null;
  paystack_transfer_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutSummary {
  totalPayouts: number;
  pendingPayouts: number;
  completedPayouts: number;
  failedPayouts: number;
  totalAmount: number;
  pendingAmount: number;
}

export class ReferralPayoutService {
  
  /**
   * Get all payout requests (Admin only)
   */
  static async getAllPayouts(): Promise<any[]> {
    const { data: payouts, error } = await supabase
      .from('agent_payout_requests')
      .select(`
        *,
        referring_agents (
          id,
          name,
          email,
          phone_number
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payouts:', error);
      throw new Error(`Failed to fetch payouts: ${error.message}`);
    }

    return payouts || [];
  }

  /**
   * Get payout requests for a specific agent
   */
  static async getAgentPayouts(agentId: string): Promise<PayoutRequest[]> {
    const { data: payouts, error } = await supabase
      .from('agent_payout_requests')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching agent payouts:', error);
      throw new Error(`Failed to fetch agent payouts: ${error.message}`);
    }

    return payouts || [];
  }

  /**
   * Get payout summary statistics
   */
  static async getPayoutSummary(): Promise<PayoutSummary> {
    const { data: payouts, error } = await supabase
      .from('agent_payout_requests')
      .select('*');

    if (error) {
      console.error('Error fetching payout summary:', error);
      throw new Error(`Failed to fetch payout summary: ${error.message}`);
    }

    const totalPayouts = payouts?.length || 0;
    const pendingPayouts = payouts?.filter(p => p.status === 'pending').length || 0;
    const completedPayouts = payouts?.filter(p => p.status === 'paid').length || 0;
    const failedPayouts = payouts?.filter(p => p.status === 'failed').length || 0;

    const totalAmount = payouts?.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;
    const pendingAmount = payouts?.filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

    return {
      totalPayouts,
      pendingPayouts,
      completedPayouts,
      failedPayouts,
      totalAmount,
      pendingAmount
    };
  }

  /**
   * Initiate bulk payout for all pending commissions
   */
  static async initiateBulkPayout(): Promise<{ success: boolean; processedAgents: number; totalAmount: number }> {
    try {
      console.log('Initiating bulk payout...');

      // Get all agents with pending commissions
      const { data: agents, error: agentsError } = await supabase
        .from('referring_agents')
        .select('id, name, pending_payout')
        .gt('pending_payout', 0);

      if (agentsError) {
        console.error('Error fetching agents for bulk payout:', agentsError);
        throw new Error(`Failed to fetch agents: ${agentsError.message}`);
      }

      if (!agents || agents.length === 0) {
        return { success: true, processedAgents: 0, totalAmount: 0 };
      }

      const agentIds = agents.map(agent => agent.id);
      const totalAmount = agents.reduce((sum, agent) => sum + (agent.pending_payout || 0), 0);

      // Call edge function to process bulk payout
      const { data, error } = await supabase.functions.invoke('referral-payout-bulk', {
        body: {
          agentIds,
          totalAmount
        }
      });

      if (error) {
        console.error('Error processing bulk payout:', error);
        throw new Error(`Failed to process bulk payout: ${error.message}`);
      }

      console.log('Bulk payout initiated successfully:', data);
      return {
        success: true,
        processedAgents: agentIds.length,
        totalAmount
      };
    } catch (error) {
      console.error('Error in bulk payout:', error);
      throw error;
    }
  }

  /**
   * Initiate payout for specific agent
   */
  static async initiateAgentPayout(agentId: string): Promise<{ success: boolean; payoutId: string }> {
    try {
      console.log('Initiating agent payout:', agentId);

      // Call edge function to process agent payout
      const { data, error } = await supabase.functions.invoke('referral-payout-agent', {
        body: {
          agentId
        }
      });

      if (error) {
        console.error('Error processing agent payout:', error);
        throw new Error(`Failed to process agent payout: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Payout processing failed');
      }

      console.log('Agent payout initiated successfully:', data);
      return {
        success: true,
        payoutId: data.payoutId
      };
    } catch (error) {
      console.error('Error in agent payout:', error);
      throw error;
    }
  }

  /**
   * Approve payout request (Admin only)
   */
  static async approvePayout(payoutId: string, adminId: string): Promise<void> {
    const { error } = await supabase
      .from('agent_payout_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: adminId
      })
      .eq('id', payoutId);

    if (error) {
      console.error('Error approving payout:', error);
      throw new Error(`Failed to approve payout: ${error.message}`);
    }

    console.log('Payout approved successfully:', payoutId);
  }

  /**
   * Reject payout request (Admin only)
   */
  static async rejectPayout(payoutId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('agent_payout_requests')
      .update({
        status: 'rejected',
        failure_reason: reason,
        approved_at: new Date().toISOString()
      })
      .eq('id', payoutId);

    if (error) {
      console.error('Error rejecting payout:', error);
      throw new Error(`Failed to reject payout: ${error.message}`);
    }

    console.log('Payout rejected successfully:', payoutId);
  }

  /**
   * Get payout by ID
   */
  static async getPayoutById(payoutId: string): Promise<PayoutRequest | null> {
    const { data: payout, error } = await supabase
      .from('agent_payout_requests')
      .select('*')
      .eq('id', payoutId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching payout:', error);
      throw new Error(`Failed to fetch payout: ${error.message}`);
    }

    return payout;
  }

  /**
   * Get payouts with filters
   */
  static async getFilteredPayouts(filters: {
    agentId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    let query = supabase
      .from('agent_payout_requests')
      .select(`
        *,
        referring_agents (
          id,
          name,
          email,
          phone_number
        )
      `);

    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: payouts, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching filtered payouts:', error);
      throw new Error(`Failed to fetch payouts: ${error.message}`);
    }

    return payouts || [];
  }
}