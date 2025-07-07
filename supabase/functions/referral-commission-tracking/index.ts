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

      // Apply filters
      const agentId = searchParams.get('agentId');
      const status = searchParams.get('status');
      const commissionType = searchParams.get('commissionType');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (agentId) {
        query = query.eq('referring_agent_id', agentId);
      }

      if (status) {
        query = query.eq('payout_status', status);
      }

      if (commissionType) {
        query = query.eq('commission_type', commissionType);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: commissions, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify(commissions), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const { commissionId, status } = body;

      const { error } = await supabase
        .from('commission_events')
        .update({ payout_status: status })
        .eq('id', commissionId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('Error in referral-commission-tracking:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});