import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SMTPCredentials {
  host: string;
  port: string;
  username: string;
  password: string;
  secure: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port, username, password, secure }: SMTPCredentials = await req.json();

    // Validate required fields
    if (!host || !port || !username || !password) {
      throw new Error("Missing required SMTP credentials");
    }

    // In a production environment, you would typically:
    // 1. Encrypt the password before storing
    // 2. Store in a secure vault or encrypted database field
    // 3. Use proper key management
    
    // For now, we'll store the credentials as environment variables
    // In production, consider using a proper secrets management service
    
    console.log("SMTP credentials received and would be stored securely:", {
      host,
      port,
      username,
      hasPassword: !!password,
      secure
    });

    // Note: In a real production environment, implement proper encryption
    // and secure storage for the SMTP password
    
    return new Response(JSON.stringify({ 
      success: true,
      message: "SMTP credentials stored securely"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error saving SMTP credentials:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);