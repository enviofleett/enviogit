import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSecurity, PRODUCTION_SECURITY_CONFIG } from "../_shared/security.ts";

interface MobileAuthRequest {
  email: string;
  password: string;
  deviceInfo?: {
    platform: string;
    deviceId: string;
    appVersion: string;
  };
}

const secureHandler = async (req: Request): Promise<Response> => {

  try {
    const { email, password, deviceInfo }: MobileAuthRequest = await req.json();

    // Validate required fields
    if (!email || !password) {
      throw new Error("Email and password are required");
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

    console.log('Mobile Auth: Attempting GPS51 login:', {
      email,
      hashedPasswordLength: hashedPassword.length,
      deviceInfo
    });

    // Authenticate with GPS51 via proxy (GPS51-first approach)
    const { data: proxyResponse, error: proxyError } = await supabaseClient.functions.invoke('gps51-proxy', {
      body: {
        action: 'login',
        params: {
          username: email,
          password: hashedPassword,
          from: deviceInfo?.platform === 'ios' ? 'IPHONE' : 'ANDROID',
          type: 'USER'
        },
        method: 'POST'
      }
    });

    if (proxyError) {
      console.error('GPS51 authentication failed:', proxyError);
      throw new Error(`Authentication failed: ${proxyError.message}`);
    }

    // Check GPS51 response
    if (proxyResponse.status !== 0) {
      console.error('GPS51 authentication unsuccessful:', proxyResponse);
      throw new Error(`Authentication failed: ${proxyResponse.message || 'Invalid credentials'}`);
    }

    if (!proxyResponse.token) {
      throw new Error('No authentication token received from GPS51');
    }

    console.log('GPS51 authentication successful:', {
      username: email,
      hasToken: !!proxyResponse.token,
      hasUser: !!proxyResponse.user
    });

    // Try to get existing user profile, create if doesn't exist
    let { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select(`
        *,
        user_subscriptions (
          *,
          subscription_packages (*)
        )
      `)
      .eq('email', email)
      .maybeSingle();

    // If profile doesn't exist, create it for GPS51-only account
    if (!userProfile && !profileError) {
      console.log('Creating new profile for GPS51-only account:', email);
      
      // Create profile from GPS51 user data
      const { data: newProfile, error: createError } = await supabaseClient
        .from('profiles')
        .insert({
          email: email,
          name: proxyResponse.user?.username || email.split('@')[0],
          role: 'user',
          status: 'active'
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create user profile:', createError);
        // Continue anyway - GPS51 auth was successful
        userProfile = {
          id: crypto.randomUUID(),
          email: email,
          name: proxyResponse.user?.username || email.split('@')[0],
          role: 'user',
          status: 'active',
          user_subscriptions: []
        };
      } else {
        userProfile = newProfile;
      }
    } else if (profileError) {
      console.error('Error fetching user profile:', profileError);
      // Create minimal profile for GPS51-only account
      userProfile = {
        id: crypto.randomUUID(),
        email: email,
        name: proxyResponse.user?.username || email.split('@')[0],
        role: 'user',
        status: 'active',
        user_subscriptions: []
      };
    }

    // Get user's vehicles
    const { data: vehicles } = await supabaseClient
      .from('vehicles')
      .select('*')
      .eq('subscriber_id', userProfile.id);

    // Log authentication activity
    await supabaseClient
      .from('activity_logs')
      .insert({
        user_id: userProfile.id,
        activity_type: 'mobile_login',
        description: 'User logged in via mobile app',
        device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
        metadata: {
          gps51_login: true,
          platform: deviceInfo?.platform || 'unknown'
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: "Authentication successful",
      auth: {
        gps51Token: proxyResponse.token,
        gps51User: proxyResponse.user,
        sessionExpiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      },
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone_number,
        city: userProfile.city
      },
      subscription: userProfile.user_subscriptions?.[0] || null,
      vehicles: vehicles || []
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Mobile authentication error:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// Apply production security middleware
const handler = withSecurity(secureHandler, {
  rateLimit: PRODUCTION_SECURITY_CONFIG.rateLimits.auth,
  requireSignature: false // Optional for auth endpoint
});

serve(handler);