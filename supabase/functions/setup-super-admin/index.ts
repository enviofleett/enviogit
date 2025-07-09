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
    console.log('Setup super admin function called');
    
    // Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const requestBody = await req.json();
    console.log('Request body:', { ...requestBody, password: '***' });
    
    const { email, password, action } = requestBody;

    if (!email || !password || !action) {
      throw new Error("Missing required fields: email, password, or action");
    }

    if (action === 'promote_to_admin') {
      console.log(`Promoting user ${email} to admin`);
      
      // Promote existing user to admin
      const { error } = await supabaseClient.rpc('promote_user_to_admin', {
        user_email: email
      });

      if (error) {
        console.error('Promotion error:', error);
        throw error;
      }

      console.log(`User ${email} promoted successfully`);
      return new Response(JSON.stringify({
        success: true,
        message: `User ${email} promoted to admin successfully`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === 'create_admin_account') {
      console.log(`Creating admin account for ${email}`);
      
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
        console.error('Auth creation error:', authError);
        throw authError;
      }

      console.log(`User created successfully: ${authData.user?.id}`);

      // Promote the newly created user to admin
      const { error: promoteError } = await supabaseClient.rpc('promote_user_to_admin', {
        user_email: email
      });

      if (promoteError) {
        console.error('Error promoting user to admin:', promoteError);
        // Don't fail completely if promotion fails, user can be promoted later
      } else {
        console.log(`User ${email} promoted to admin successfully`);
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

    throw new Error(`Invalid action specified: ${action}`);

  } catch (error: any) {
    console.error("Setup super admin error:", error);
    
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error occurred',
      success: false,
      details: error?.details || null
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);