import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const type = searchParams.get('type');

    if (req.method === 'GET') {
      if (type === 'dashboard') {
        // Get dashboard analytics
        const [agentsResult, commissionsResult, payoutsResult, recentSignupsResult] = await Promise.all([
          // Agent statistics
          supabase.from('referring_agents').select('*'),
          
          // Commission statistics
          supabase.from('commission_events').select('*'),
          
          // Payout statistics
          supabase.from('agent_payout_requests').select('*'),
          
          // Recent signups (last 30 days)
          supabase
            .from('referrals')
            .select('id')
            .gte('signup_timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        ]);

        const agents = agentsResult.data || [];
        const commissions = commissionsResult.data || [];
        const payouts = payoutsResult.data || [];
        const recentSignups = recentSignupsResult.data || [];

        // Calculate metrics
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const analytics = {
          totalAgents: agents.length,
          activeAgents: agents.filter(a => a.status === 'active').length,
          newAgentsThisMonth: agents.filter(a => new Date(a.created_at) >= startOfMonth).length,
          
          totalCommissions: commissions.length,
          pendingCommissions: commissions.filter(c => c.payout_status === 'pending').length,
          totalCommissionAmount: commissions.reduce((sum, c) => sum + (c.amount || 0), 0),
          pendingCommissionAmount: commissions
            .filter(c => c.payout_status === 'pending')
            .reduce((sum, c) => sum + (c.amount || 0), 0),
          
          totalPayouts: payouts.length,
          pendingPayouts: payouts.filter(p => p.status === 'pending').length,
          pendingPayoutAmount: payouts
            .filter(p => p.status === 'pending')
            .reduce((sum, p) => sum + (p.amount || 0), 0),
          
          recentSignups: recentSignups.length,
          
          // Commission breakdown by type
          commissionsByType: commissions.reduce((acc, c) => {
            const type = c.commission_type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          
          // Monthly trends (last 6 months)
          monthlyTrends: await getMonthlyTrends(supabase)
        };

        return new Response(JSON.stringify(analytics), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } else if (type === 'agent-performance') {
        // Get agent performance analytics
        const { data: agentPerformance, error } = await supabase
          .from('referring_agents')
          .select(`
            id,
            name,
            email,
            total_earned,
            pending_payout,
            created_at,
            commission_events!referring_agent_id (
              amount,
              commission_type,
              created_at
            )
          `);

        if (error) throw error;

        const performanceData = (agentPerformance || []).map(agent => ({
          ...agent,
          totalReferrals: agent.commission_events?.length || 0,
          avgCommission: agent.commission_events?.length > 0
            ? agent.commission_events.reduce((sum, c) => sum + (c.amount || 0), 0) / agent.commission_events.length
            : 0,
          lastActivity: agent.commission_events?.length > 0
            ? Math.max(...agent.commission_events.map(c => new Date(c.created_at).getTime()))
            : null
        }));

        return new Response(JSON.stringify(performanceData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } else if (type === 'commission-rates') {
        // Get commission rates
        const { data: rates, error } = await supabase
          .from('referral_commission_rates')
          .select('*')
          .eq('is_active', true);

        if (error) throw error;

        return new Response(JSON.stringify(rates), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (req.method === 'PUT' && type === 'commission-rates') {
      const body = await req.json();
      const { rates } = body;

      for (const rate of rates) {
        const { error } = await supabase
          .from('referral_commission_rates')
          .update({ percentage: rate.percentage })
          .eq('commission_type', rate.commission_type)
          .eq('is_active', true);

        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('Error in referral-analytics:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getMonthlyTrends(supabase: any) {
  const trends = [];
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const [commissionsResult, signupsResult] = await Promise.all([
      supabase
        .from('commission_events')
        .select('amount')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString()),
      
      supabase
        .from('referrals')
        .select('id')
        .gte('signup_timestamp', startOfMonth.toISOString())
        .lte('signup_timestamp', endOfMonth.toISOString())
    ]);

    const commissions = commissionsResult.data || [];
    const signups = signupsResult.data || [];

    trends.push({
      month: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
      commissionAmount: commissions.reduce((sum, c) => sum + (c.amount || 0), 0),
      commissionCount: commissions.length,
      signups: signups.length
    });
  }

  return trends;
}