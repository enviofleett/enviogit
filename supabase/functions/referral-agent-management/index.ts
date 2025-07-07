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
    const pathParts = url.pathname.split('/');
    const agentId = pathParts[pathParts.length - 1];

    if (req.method === 'GET') {
      if (agentId && agentId !== 'referral-agent-management') {
        // Get specific agent
        const { data: agent, error } = await supabase
          .from('referring_agents')
          .select('*')
          .eq('id', agentId)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(agent), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Get all agents
        const { data: agents, error } = await supabase
          .from('referring_agents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify(agents), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { name, email, phone_number, bank_account_info } = body;

      // Generate unique referral code
      const referralCode = `REF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      const { data: agent, error } = await supabase
        .from('referring_agents')
        .insert({
          name,
          email,
          phone_number,
          bank_account_info,
          referral_code: referralCode,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(agent), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const { name, email, phone_number, bank_account_info, status } = body;

      const { data: agent, error } = await supabase
        .from('referring_agents')
        .update({
          name,
          email,
          phone_number,
          bank_account_info,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(agent), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('Error in referral-agent-management:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});