import { supabase } from '@/integrations/supabase/client';

export interface ReferralAgent {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  bank_account_info: any;
  referral_code: string;
  status: string;
  total_earned: number | null;
  pending_payout: number | null;
  created_at: string;
  updated_at: string;
}

export interface NewReferralAgent {
  name: string;
  email: string;
  phone_number: string;
  bank_account_info: {
    bank_name: string;
    account_name: string;
    account_number: string;
  };
}

export class ReferralAgentService {
  
  /**
   * Get all referral agents (Admin only)
   */
  static async getAllAgents(): Promise<ReferralAgent[]> {
    const { data: agents, error } = await supabase
      .from('referring_agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching referral agents:', error);
      throw new Error(`Failed to fetch agents: ${error.message}`);
    }

    return agents || [];
  }

  /**
   * Get referral agent by ID
   */
  static async getAgentById(agentId: string): Promise<ReferralAgent | null> {
    const { data: agent, error } = await supabase
      .from('referring_agents')
      .select('*')
      .eq('id', agentId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching agent:', error);
      throw new Error(`Failed to fetch agent: ${error.message}`);
    }

    return agent;
  }

  /**
   * Create new referral agent
   */
  static async createAgent(agentData: NewReferralAgent): Promise<ReferralAgent> {
    // Generate unique referral code
    const referralCode = `REF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const { data: agent, error } = await supabase
      .from('referring_agents')
      .insert({
        ...agentData,
        referral_code: referralCode,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating agent:', error);
      throw new Error(`Failed to create agent: ${error.message}`);
    }

    console.log('Agent created successfully:', agent.id);
    return agent;
  }

  /**
   * Update referral agent
   */
  static async updateAgent(agentId: string, updates: Partial<NewReferralAgent>): Promise<ReferralAgent> {
    const { data: agent, error } = await supabase
      .from('referring_agents')
      .update(updates)
      .eq('id', agentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating agent:', error);
      throw new Error(`Failed to update agent: ${error.message}`);
    }

    console.log('Agent updated successfully:', agentId);
    return agent;
  }

  /**
   * Update agent status
   */
  static async updateAgentStatus(agentId: string, status: 'active' | 'inactive'): Promise<void> {
    const { error } = await supabase
      .from('referring_agents')
      .update({ status })
      .eq('id', agentId);

    if (error) {
      console.error('Error updating agent status:', error);
      throw new Error(`Failed to update agent status: ${error.message}`);
    }

    console.log('Agent status updated successfully:', agentId, status);
  }

  /**
   * Get agent commission summary
   */
  static async getAgentCommissionSummary(agentId: string): Promise<{
    totalEarnings: number;
    pendingCommissions: number;
    paidCommissions: number;
    totalReferrals: number;
  }> {
    // Get commission events for this agent
    const { data: commissions, error: commissionsError } = await supabase
      .from('commission_events')
      .select('*')
      .eq('referring_agent_id', agentId);

    if (commissionsError) {
      console.error('Error fetching agent commissions:', commissionsError);
      throw new Error(`Failed to fetch commissions: ${commissionsError.message}`);
    }

    // Get referrals for this agent
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referring_agent_id', agentId);

    if (referralsError) {
      console.error('Error fetching agent referrals:', referralsError);
      throw new Error(`Failed to fetch referrals: ${referralsError.message}`);
    }

    const totalEarnings = commissions?.reduce((sum, comm) => sum + parseFloat(comm.amount.toString()), 0) || 0;
    const pendingCommissions = commissions?.filter(c => c.payout_status === 'pending')
      .reduce((sum, comm) => sum + parseFloat(comm.amount.toString()), 0) || 0;
    const paidCommissions = commissions?.filter(c => c.payout_status === 'paid')
      .reduce((sum, comm) => sum + parseFloat(comm.amount.toString()), 0) || 0;

    return {
      totalEarnings,
      pendingCommissions,
      paidCommissions,
      totalReferrals: referrals?.length || 0
    };
  }

  /**
   * Search agents by query
   */
  static async searchAgents(query: string): Promise<ReferralAgent[]> {
    const { data: agents, error } = await supabase
      .from('referring_agents')
      .select('*')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone_number.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching agents:', error);
      throw new Error(`Failed to search agents: ${error.message}`);
    }

    return agents || [];
  }

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    inactiveAgents: number;
    newAgentsThisMonth: number;
  }> {
    const { data: agents, error } = await supabase
      .from('referring_agents')
      .select('*');

    if (error) {
      console.error('Error fetching dashboard stats:', error);
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalAgents = agents?.length || 0;
    const activeAgents = agents?.filter(a => a.status === 'active').length || 0;
    const inactiveAgents = agents?.filter(a => a.status === 'inactive').length || 0;
    const newAgentsThisMonth = agents?.filter(a => new Date(a.created_at) >= startOfMonth).length || 0;

    return {
      totalAgents,
      activeAgents,
      inactiveAgents,
      newAgentsThisMonth
    };
  }
}