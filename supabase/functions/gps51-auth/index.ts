
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51AuthRequest {
  username: string;
  password: string;
  apiKey: string;
}

interface GPS51AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('GPS51 authentication request received');

    const { username, password, apiKey }: GPS51AuthRequest = await req.json();

    if (!username || !password || !apiKey) {
      throw new Error('Missing required authentication parameters');
    }

    // GPS51 API authentication endpoint
    const gps51AuthUrl = Deno.env.get('GPS51_AUTH_URL') || 'https://api.gps51.com/oauth/token';
    
    console.log('Authenticating with GPS51 API...');

    const authResponse = await fetch(gps51AuthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        grant_type: 'password',
        username,
        password,
        scope: 'read write'
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('GPS51 auth failed:', authResponse.status, errorText);
      throw new Error(`GPS51 authentication failed: ${authResponse.status}`);
    }

    const authData: GPS51AuthResponse = await authResponse.json();
    
    console.log('GPS51 authentication successful');

    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.access_token,
        token_type: authData.token_type || 'Bearer',
        expires_in: authData.expires_in || 3600,
        scope: authData.scope
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

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
