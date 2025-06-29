
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    let requestBody
    try {
      const bodyText = await req.text()
      console.log('Raw request body:', bodyText)
      
      if (!bodyText.trim()) {
        return new Response(
          JSON.stringify({ error: 'Empty request body. Expected JSON with GPS51 credentials.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      requestBody = JSON.parse(bodyText)
      console.log('Parsed request body:', requestBody)
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate required fields
    const { username, password, apiUrl } = requestBody
    if (!username || !password || !apiUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: username, password, apiUrl' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare GPS51 API login payload
    const gps51LoginPayload = {
      action: 'login',
      username: username,
      password: password, // Should be MD5 hashed
      from: 'WEB',
      type: 'USER'
    }

    console.log('Attempting GPS51 API login...')
    
    // Make request to GPS51 API
    const gps51Response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gps51LoginPayload)
    })

    console.log(`GPS51 API Response Status: ${gps51Response.status}`)
    
    // Read response as text first
    const responseText = await gps51Response.text()
    console.log(`GPS51 API Raw Response: ${responseText}`)

    if (!gps51Response.ok) {
      console.error(`GPS51 API error: ${gps51Response.status}`)
      return new Response(
        JSON.stringify({ 
          error: `GPS51 API returned status ${gps51Response.status}`,
          details: responseText
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Try to parse response as JSON
    let gps51Data
    try {
      gps51Data = JSON.parse(responseText)
      console.log('GPS51 API Parsed Data:', gps51Data)
    } catch (jsonError) {
      console.error('Failed to parse GPS51 API response as JSON:', jsonError)
      
      // If it's not JSON but successful, treat as success
      if (gps51Response.ok) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'GPS51 sync completed (non-JSON response)',
            rawResponse: responseText
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to parse GPS51 API response',
            rawResponse: responseText
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Check if login was successful
    if (gps51Data.status === 0 && gps51Data.token) {
      console.log('GPS51 login successful, token received')
      
      // TODO: Implement device list fetching and position sync
      // For now, return success
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'GPS51 authentication successful',
          vehiclesSynced: 0,
          positionsStored: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } else {
      console.error('GPS51 login failed:', gps51Data.message)
      return new Response(
        JSON.stringify({ 
          error: `GPS51 login failed: ${gps51Data.message || 'Unknown error'}`,
          status: gps51Data.status
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('GPS51 sync error:', error)
    return new Response(
      JSON.stringify({ 
        error: `Internal server error: ${error.message}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
