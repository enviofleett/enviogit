
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

    // Here you would typically authenticate with the GPS51 API
    // For now, we'll return a mock token
    console.log(`Authenticating user ${username} with GPS51 API at ${apiUrl}`);

    // Mock authentication - replace with actual GPS51 API call
    const mockResponse = {
      success: true,
      access_token: 'mock_token_' + Date.now(),
      token_type: 'Bearer',
      expires_in: 3600
    };

    console.log('GPS51 authentication successful');

    return new Response(
      JSON.stringify(mockResponse),
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
