import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPVerificationRequest {
  token: string;
  otp: string;
  phone?: string;
  email?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, otp, phone, email }: OTPVerificationRequest = await req.json();

    if (!token || !otp) {
      throw new Error("Token and OTP are required");
    }

    // TODO: In production, retrieve OTP from Redis/database using token
    // For demo purposes, we'll accept any 6-digit number as valid
    
    console.log(`OTP Verification: Verifying token ${token}`, {
      otp,
      recipient: phone || email
    });

    // Simple validation for demo
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      throw new Error("Invalid OTP format");
    }

    // In production, check:
    // - Token exists and not expired
    // - OTP matches stored value
    // - Rate limiting

    const isValid = true; // Demo: always valid for 6-digit numbers
    
    if (!isValid) {
      throw new Error("Invalid or expired OTP");
    }

    // Generate verification token for registration process
    const verificationToken = `verified_${Date.now()}_${Math.random().toString(36)}`;

    console.log(`OTP Verification: Success for ${phone || email}`);

    return new Response(JSON.stringify({
      success: true,
      message: "OTP verified successfully",
      verificationToken,
      verified: true
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("OTP verification error:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      verified: false
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);