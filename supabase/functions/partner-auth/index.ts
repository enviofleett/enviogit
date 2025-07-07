import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSecurity, PRODUCTION_SECURITY_CONFIG } from "../_shared/security.ts";

interface PartnerAuthRequest {
  action: 'register' | 'login' | 'profile' | 'update_profile';
  email?: string;
  password?: string;
  name?: string;
  phone_number?: string;
  city?: string;
  country?: string;
  bank_account_info?: any;
  nin?: string;
  office_address?: string;
  profile_picture_url?: string;
  profile_literature?: string;
  updates?: any;
}

const secureHandler = async (req: Request): Promise<Response> => {
  try {
    const body: PartnerAuthRequest = await req.json();
    const { action } = body;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (action) {
      case 'register':
        return await handlePartnerRegistration(supabaseClient, body);
      case 'login':
        return await handlePartnerLogin(supabaseClient, body);
      case 'profile':
        return await handleGetProfile(supabaseClient, req);
      case 'update_profile':
        return await handleUpdateProfile(supabaseClient, req, body);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
    }
  } catch (error: any) {
    console.error("Partner Auth Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      success: false 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

async function handlePartnerRegistration(supabaseClient: any, body: PartnerAuthRequest) {
  console.log('Handling partner registration');

  const { email, password, name, phone_number, city, country, bank_account_info, nin, office_address, profile_picture_url, profile_literature } = body;

  if (!email || !password || !name || !phone_number) {
    throw new Error('Email, password, name, and phone number are required');
  }

  // Create user account
  const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role: 'technical_partner'
    }
  });

  if (authError) {
    console.error('Auth user creation failed:', authError);
    throw new Error(`Account creation failed: ${authError.message}`);
  }

  // Create technical partner profile
  const { data: partner, error: partnerError } = await supabaseClient
    .from('technical_partners')
    .insert({
      user_id: authUser.user.id,
      name,
      phone_number,
      email,
      city,
      country,
      bank_account_info: bank_account_info || {},
      nin,
      office_address,
      profile_picture_url,
      profile_literature,
      status: 'pending'
    })
    .select()
    .single();

  if (partnerError) {
    console.error('Partner profile creation failed:', partnerError);
    // Clean up auth user if partner creation fails
    await supabaseClient.auth.admin.deleteUser(authUser.user.id);
    throw new Error(`Partner registration failed: ${partnerError.message}`);
  }

  console.log('Technical partner registered successfully:', partner.id);

  return new Response(JSON.stringify({
    success: true,
    message: 'Technical partner registered successfully. Awaiting approval.',
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      status: partner.status
    }
  }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
}

async function handlePartnerLogin(supabaseClient: any, body: PartnerAuthRequest) {
  console.log('Handling partner login');

  const { email, password } = body;

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // Authenticate user
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('Authentication failed:', authError);
    throw new Error('Invalid email or password');
  }

  // Get partner profile
  const { data: partner, error: partnerError } = await supabaseClient
    .from('technical_partners')
    .select('*')
    .eq('user_id', authData.user.id)
    .single();

  if (partnerError || !partner) {
    console.error('Partner profile not found:', partnerError);
    throw new Error('Technical partner profile not found');
  }

  if (partner.status !== 'approved') {
    throw new Error(`Account status: ${partner.status}. Please contact administrator.`);
  }

  console.log('Partner login successful:', partner.id);

  return new Response(JSON.stringify({
    success: true,
    message: 'Login successful',
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email,
      status: partner.status,
      city: partner.city,
      country: partner.country
    },
    session: authData.session
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleGetProfile(supabaseClient: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

  if (userError || !user) {
    throw new Error('Invalid or expired token');
  }

  const { data: partner, error: partnerError } = await supabaseClient
    .from('technical_partners')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (partnerError || !partner) {
    throw new Error('Partner profile not found');
  }

  return new Response(JSON.stringify({
    success: true,
    partner
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function handleUpdateProfile(supabaseClient: any, req: Request, body: PartnerAuthRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

  if (userError || !user) {
    throw new Error('Invalid or expired token');
  }

  const { data: partner, error: updateError } = await supabaseClient
    .from('technical_partners')
    .update(body.updates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Profile update failed: ${updateError.message}`);
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Profile updated successfully',
    partner
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

const handler = withSecurity(secureHandler, {
  rateLimit: PRODUCTION_SECURITY_CONFIG.rateLimits.auth,
  requireSignature: false
});

serve(handler);