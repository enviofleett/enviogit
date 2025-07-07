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

    const { userId, packageId } = await req.json();

    if (!userId) {
      throw new Error('User ID is required');
    }

    const today = new Date().toISOString().split('T')[0];

    // Get or create usage tracking record
    let { data: usage, error } = await supabase
      .from('chatbot_usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Record doesn't exist, create it
      const { data: newUsage, error: createError } = await supabase
        .from('chatbot_usage_tracking')
        .insert({
          user_id: userId,
          package_id: packageId,
          prompts_today: 1,
          prompts_this_week: 1,
          prompts_this_month: 1,
          last_reset_date: today
        })
        .select()
        .single();

      if (createError) throw createError;
      
      return new Response(JSON.stringify({ success: true, usage: newUsage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (error) throw error;

    // Check if we need to reset counters
    const lastReset = new Date(usage.last_reset_date);
    const currentDate = new Date(today);
    const daysDiff = Math.floor((currentDate.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));

    let updatedUsage = {
      prompts_today: usage.prompts_today + 1,
      prompts_this_week: usage.prompts_this_week + 1,
      prompts_this_month: usage.prompts_this_month + 1,
      last_reset_date: usage.last_reset_date,
      package_id: packageId
    };

    // Reset daily counter if it's a new day
    if (daysDiff >= 1) {
      updatedUsage.prompts_today = 1;
      updatedUsage.last_reset_date = today;
    }

    // Reset weekly counter if it's been 7 days
    if (daysDiff >= 7) {
      updatedUsage.prompts_this_week = 1;
    }

    // Reset monthly counter if it's been 30 days
    if (daysDiff >= 30) {
      updatedUsage.prompts_this_month = 1;
    }

    // Update the record
    const { data: updated, error: updateError } = await supabase
      .from('chatbot_usage_tracking')
      .update(updatedUsage)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, usage: updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Update chatbot usage error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});