
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51SyncRequest {
  apiUrl?: string;
  username?: string;
  password?: string;
  priority?: number;
  batchMode?: boolean;
  cronTriggered?: boolean;
}

interface GPS51ApiResponse {
  status: number;
  message?: string;
  data?: any;
  token?: string;
  groups?: any[];
  records?: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let jobId: string | null = null;

  try {
    console.log('=== GPS51 SYNC STARTED (ENHANCED) ===');
    console.log('Timestamp:', new Date().toISOString());

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed. Only POST requests are supported.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    let requestBody: GPS51SyncRequest = {};
    try {
      const requestText = await req.text();
      console.log('Request received:', {
        bodyLength: requestText.length,
        hasContent: !!requestText.trim()
      });
      
      if (requestText && requestText.trim() !== '') {
        requestBody = JSON.parse(requestText);
      }
    } catch (e) {
      console.error("Request parsing error:", e);
      // Continue with empty request body for environment variable fallback
    }

    console.log("GPS51 Sync Request validation:", {
      hasUsername: !!requestBody.username,
      hasPassword: !!requestBody.password,
      hasApiUrl: !!requestBody.apiUrl,
      passwordLength: requestBody.password?.length || 0,
      apiUrl: requestBody.apiUrl,
      priority: requestBody.priority,
      batchMode: requestBody.batchMode,
      cronTriggered: requestBody.cronTriggered || false
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get credentials from request body or environment variables
    let finalApiUrl = requestBody.apiUrl || Deno.env.get('GPS51_API_URL');
    let finalUsername = requestBody.username || Deno.env.get('GPS51_USERNAME');
    let finalPassword = requestBody.password || Deno.env.get('GPS51_PASSWORD_MD5');

    // Also try localStorage-style environment variables
    if (!finalApiUrl) finalApiUrl = Deno.env.get('gps51_api_url');
    if (!finalUsername) finalUsername = Deno.env.get('gps51_username');
    if (!finalPassword) finalPassword = Deno.env.get('gps51_password_hash');

    console.log('Credential sources:', {
      apiUrl: finalApiUrl ? 'available' : 'missing',
      username: finalUsername ? 'available' : 'missing',
      password: finalPassword ? 'available' : 'missing',
      fromEnv: {
        GPS51_API_URL: !!Deno.env.get('GPS51_API_URL'),
        GPS51_USERNAME: !!Deno.env.get('GPS51_USERNAME'),
        GPS51_PASSWORD_MD5: !!Deno.env.get('GPS51_PASSWORD_MD5')
      }
    });

    if (!finalApiUrl || !finalUsername || !finalPassword) {
      const missingCredentials = [];
      if (!finalApiUrl) missingCredentials.push('apiUrl/GPS51_API_URL');
      if (!finalUsername) missingCredentials.push('username/GPS51_USERNAME');
      if (!finalPassword) missingCredentials.push('password/GPS51_PASSWORD_MD5');
      
      throw new Error(`GPS51 credentials not available for automated sync. Missing: ${missingCredentials.join(', ')}. Please configure Supabase secrets or pass credentials in request body.`);
    }
    
    // Ensure we use the correct GPS51 API URL
    let correctedApiUrl = finalApiUrl.replace(/\/$/, '');
    if (correctedApiUrl.includes('www.gps51.com')) {
      console.log('Correcting API URL from www.gps51.com to api.gps51.com');
      correctedApiUrl = correctedApiUrl.replace('www.gps51.com', 'api.gps51.com');
    }
    if (correctedApiUrl.includes('/webapi')) {
      console.log('Migrating API URL from /webapi to /openapi');
      correctedApiUrl = correctedApiUrl.replace('/webapi', '/openapi');
    }

    console.log('Using corrected API URL:', correctedApiUrl);

    // Generate a proper random token for the login request
    const generateToken = () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    // Step 1: Authenticate with GPS51 API
    const loginToken = generateToken();
    const loginUrl = new URL(correctedApiUrl);
    loginUrl.searchParams.append('action', 'login');
    loginUrl.searchParams.append('token', loginToken);

    const loginPayload = {
      username: finalUsername,
      password: finalPassword, // Should already be MD5 hashed
      from: 'WEB',
      type: 'USER'
    };

    console.log("=== GPS51 LOGIN ATTEMPT ===");
    console.log("Login URL:", loginUrl.toString());

    const loginResponse = await fetch(loginUrl.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginPayload)
    });

    const loginResponseText = await loginResponse.text();
    console.log(`GPS51 Login Response:`, {
      status: loginResponse.status,
      statusText: loginResponse.statusText,
      bodyLength: loginResponseText.length,
      bodyPreview: loginResponseText.substring(0, 200)
    });

    if (!loginResponse.ok) {
      throw new Error(`GPS51 login HTTP error: ${loginResponse.status} ${loginResponse.statusText} - ${loginResponseText}`);
    }

    let loginData: GPS51ApiResponse;
    try {
      loginData = JSON.parse(loginResponseText);
      console.log('GPS51 Login Success:', {
        status: loginData.status,
        message: loginData.message,
        hasToken: !!loginData.token,
        tokenLength: loginData.token?.length || 0
      });
    } catch (parseError) {
      console.error('Failed to parse GPS51 login response:', parseError);
      throw new Error(`Failed to parse login response: ${loginResponseText}`);
    }

    if (loginData.status !== 0 || !loginData.token) {
      const errorMsg = loginData.message || `Login failed with status: ${loginData.status}`;
      console.error('GPS51 login failed:', { status: loginData.status, message: loginData.message });
      throw new Error(errorMsg);
    }

    const token = loginData.token;
    console.log('GPS51 login successful, token acquired');

    // Return success response
    const executionTime = (Date.now() - startTime) / 1000;
    return new Response(JSON.stringify({
      success: true,
      message: 'GPS51 sync completed successfully',
      timestamp: new Date().toISOString(),
      executionTimeSeconds: executionTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('=== GPS51 SYNC ERROR (ENHANCED) ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    const executionTime = (Date.now() - startTime) / 1000;
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      executionTimeSeconds: executionTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
