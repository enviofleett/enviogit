import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  phone?: string;
  email?: string;
  type: 'registration' | 'login' | 'password_reset';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, email, type }: OTPRequest = await req.json();

    if (!phone && !email) {
      throw new Error("Either phone or email is required");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in memory/cache (in production, use Redis or database)
    const otpToken = `otp_${Date.now()}_${Math.random().toString(36)}`;
    
    // TODO: In production, integrate with:
    // - Twilio for SMS
    // - SendGrid/Resend for Email
    // - Firebase Auth for phone verification
    
    console.log(`OTP Service: Generated OTP for ${type}`, {
      recipient: phone || email,
      otp,
      expiresAt,
      token: otpToken
    });

    // For demo purposes, always return success
    // In production, make actual API calls to SMS/email services
    if (phone) {
      console.log(`SMS OTP: Send "${otp}" to ${phone}`);
      // await sendSMS(phone, `Your verification code is: ${otp}`);
    }

    if (email) {
      console.log(`Email OTP: Send "${otp}" to ${email}`);
      // await sendEmail(email, `Your verification code is: ${otp}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "OTP sent successfully",
      token: otpToken,
      expiresAt: expiresAt.toISOString(),
      // In production, don't return OTP in response
      debug: {
        otp: otp, // Only for testing
        recipient: phone || email
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("OTP sending error:", error);
    
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