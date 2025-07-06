import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, password, action } = await req.json();

    if (action === 'promote_to_admin') {
      // Promote existing user to admin
      const { error } = await supabaseClient.rpc('promote_user_to_admin', {
        user_email: email
      });

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        message: `User ${email} promoted to admin successfully`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === 'create_admin_account') {
      // Create new admin account
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: 'Super Admin',
          role: 'admin'
        }
      });

      if (authError) {
        throw authError;
      }

      // Promote the newly created user to admin
      const { error: promoteError } = await supabaseClient.rpc('promote_user_to_admin', {
        user_email: email
      });

      if (promoteError) {
        console.error('Error promoting user to admin:', promoteError);
        // Don't fail completely if promotion fails, user can be promoted later
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Admin account created successfully for ${email}`,
        user_id: authData.user?.id
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    throw new Error('Invalid action specified');

  } catch (error: any) {
    console.error("Setup super admin error:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);