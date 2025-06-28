
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51AuthRequest {
  username: string;
  password: string;
  apiKey: string;
  apiUrl: string; // Now accepting dynamic API URL
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

    const { username, password, apiKey, apiUrl }: GPS51AuthRequest = await req.json();

    if (!username || !password || !apiKey || !apiUrl) {
      throw new Error('Missing required authentication parameters: username, password, apiKey, and apiUrl are required');
    }

    // Use the provided API URL instead of environment variable
    const gps51AuthUrl = `${apiUrl.replace(/\/$/, '')}/oauth/token`;
    
    console.log('Authenticating with GPS51 API at:', gps51AuthUrl);

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
      throw new Error(`GPS51 authentication failed: ${authResponse.status} - ${errorText}`);
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
