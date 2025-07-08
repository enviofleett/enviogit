
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51AuthRequest {
  username: string;
  password: string;
  apiKey: string;
  apiUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('GPS51 authentication request received');

    const requestBody = await req.text();
    if (!requestBody) {
      throw new Error('Empty request body received');
    }

    const { username, password, apiKey, apiUrl }: GPS51AuthRequest = JSON.parse(requestBody);

    if (!username || !password || !apiKey || !apiUrl) {
      throw new Error('Missing required authentication parameters: username, password, apiKey, and apiUrl are required');
    }

    // PRODUCTION FIX: Real GPS51 authentication
    console.log(`Authenticating user ${username} with GPS51 API at ${apiUrl}`);

    // Prepare authentication request to GPS51 API
    const authPayload = {
      username,
      password, // Should be MD5 hashed
      from: 'WEB',
      type: 'USER'
    };

    // Make real authentication request to GPS51
    const gps51Response = await fetch(`${apiUrl}?action=login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(authPayload)
    });

    const authResult = await gps51Response.json();
    
    if (authResult.status === 0 && authResult.token) {
      // Successful authentication
      const response = {
        success: true,
        access_token: authResult.token,
        token_type: 'Bearer',
        expires_in: 24 * 60 * 60, // 24 hours
        user: authResult.user || { username },
        gps51_status: authResult.status
      };
      
      console.log('GPS51 authentication successful:', { username, hasToken: !!response.access_token });
      
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Authentication failed
      throw new Error(`GPS51 authentication failed: ${authResult.message || 'Invalid credentials'}`);
    }

  } catch (error) {
    console.error('GPS51 authentication error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
