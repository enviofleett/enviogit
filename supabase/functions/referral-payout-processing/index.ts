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

    if (req.method === 'GET') {
      // Get payout requests with filters
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

      const agentId = searchParams.get('agentId');
      const status = searchParams.get('status');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: payouts, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify(payouts), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { type, agentIds, agentId } = body;

      if (type === 'bulk') {
        // Process bulk payout
        const { data: agents, error: agentsError } = await supabase
          .from('referring_agents')
          .select('id, name, pending_payout, bank_account_info')
          .in('id', agentIds)
          .gt('pending_payout', 0);

        if (agentsError) throw agentsError;

        const payoutRequests = [];

        for (const agent of agents || []) {
          const { data: payoutRequest, error: payoutError } = await supabase
            .from('agent_payout_requests')
            .insert({
              agent_id: agent.id,
              amount: agent.pending_payout,
              status: 'pending',
              requested_at: new Date().toISOString()
            })
            .select()
            .single();

          if (payoutError) {
            console.error('Error creating payout request:', payoutError);
            continue;
          }

          payoutRequests.push(payoutRequest);

          // Update commission events to mark as paid
          await supabase
            .from('commission_events')
            .update({ payout_status: 'processing' })
            .eq('referring_agent_id', agent.id)
            .eq('payout_status', 'pending');

          // Reset agent pending payout
          await supabase
            .from('referring_agents')
            .update({ pending_payout: 0 })
            .eq('id', agent.id);
        }

        return new Response(JSON.stringify({
          success: true,
          processedAgents: payoutRequests.length,
          totalAmount: payoutRequests.reduce((sum, req) => sum + req.amount, 0)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } else if (type === 'individual' && agentId) {
        // Process individual agent payout
        const { data: agent, error: agentError } = await supabase
          .from('referring_agents')
          .select('pending_payout, bank_account_info')
          .eq('id', agentId)
          .single();

        if (agentError) throw agentError;

        if (!agent || agent.pending_payout <= 0) {
          throw new Error('No pending payout for this agent');
        }

        const { data: payoutRequest, error: payoutError } = await supabase
          .from('agent_payout_requests')
          .insert({
            agent_id: agentId,
            amount: agent.pending_payout,
            status: 'pending',
            requested_at: new Date().toISOString()
          })
          .select()
          .single();

        if (payoutError) throw payoutError;

        // Update commission events to mark as processing
        await supabase
          .from('commission_events')
          .update({ payout_status: 'processing' })
          .eq('referring_agent_id', agentId)
          .eq('payout_status', 'pending');

        // Reset agent pending payout
        await supabase
          .from('referring_agents')
          .update({ pending_payout: 0 })
          .eq('id', agentId);

        return new Response(JSON.stringify({
          success: true,
          payoutId: payoutRequest.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const { payoutId, status, adminId, reason } = body;

      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = adminId;
      } else if (status === 'rejected') {
        updateData.failure_reason = reason;
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('agent_payout_requests')
        .update(updateData)
        .eq('id', payoutId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('Error in referral-payout-processing:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});