import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserRegistrationRequest {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  password: string;
  otpToken?: string; // OTP verification token
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fullName, email, phone, city, country, password, otpToken }: UserRegistrationRequest = await req.json();

    // Validate required fields
    if (!fullName || !email || !phone || !city || !country || !password) {
      throw new Error("All fields are required");
    }

    // TODO: Verify OTP token here when OTP service is integrated
    if (!otpToken) {
      return new Response(JSON.stringify({ 
        error: "OTP verification required",
        requiresOTP: true 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Hash password for GPS51 (MD5)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('User Registration: Creating GPS51 user:', {
      email,
      hashedPasswordLength: hashedPassword.length
    });

    // Create user in GPS51 via proxy
    const { data: proxyResponse, error: proxyError } = await supabaseClient.functions.invoke('gps51-proxy', {
      body: {
        action: 'adduser',
        params: {
          username: email, // Use email as GPS51 username
          password: hashedPassword,
          usertype: 11, // End User
          multilogin: 1, // Allow multiple logins
          creater: 'SYSTEM', // System created user
          companyname: '', // Individual user
          showname: fullName
        },
        method: 'POST'
      }
    });

    if (proxyError) {
      console.error('GPS51 user creation failed:', proxyError);
      throw new Error(`GPS51 registration failed: ${proxyError.message}`);
    }

    // Check GPS51 response
    if (proxyResponse.status !== 0) {
      console.error('GPS51 user creation unsuccessful:', proxyResponse);
      throw new Error(`GPS51 registration failed: ${proxyResponse.message || 'Unknown error'}`);
    }

    console.log('GPS51 user created successfully:', {
      username: email,
      gps51Response: proxyResponse
    });

    // Store extended user profile in Supabase
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        name: fullName,
        email: email,
        phone_number: phone,
        city: city,
        // Store GPS51 username for linking
        notes: JSON.stringify({ 
          gps51_username: email,
          country: country,
          registration_source: 'mobile_app'
        })
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation failed:', profileError);
      // GPS51 user was created, but profile storage failed
      // In production, consider cleanup or retry logic
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    // Create default subscription (trial)
    const { data: packages } = await supabaseClient
      .from('subscription_packages')
      .select('*')
      .eq('name', 'Basic')
      .eq('is_active', true)
      .single();

    if (packages) {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + packages.trial_days);

      await supabaseClient
        .from('user_subscriptions')
        .insert({
          user_id: profileData.id,
          package_id: packages.id,
          status: 'trial',
          trial_end_date: trialEndDate.toISOString()
        });
    }

    console.log('User registration completed successfully:', {
      profileId: profileData.id,
      gps51Username: email
    });

    return new Response(JSON.stringify({
      success: true,
      message: "User registered successfully",
      profile: {
        id: profileData.id,
        name: fullName,
        email: email,
        gps51_username: email
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("User registration error:", error);
    
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