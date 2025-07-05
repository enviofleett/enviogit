import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  from?: string;
  replyTo?: string;
  template?: string;
  data?: any;
  html?: string;
}

const getEmailTemplate = (template: string, data: any): string => {
  switch (template) {
    case 'test':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🚗 Fleet Management System</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Email Configuration Test</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">✅ Email Test Successful!</h2>
            <p style="color: #666; line-height: 1.6;">
              ${data.testMessage || 'Your email configuration is working correctly!'}
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="color: #333; margin-top: 0;">Test Details:</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li><strong>Timestamp:</strong> ${data.timestamp || new Date().toISOString()}</li>
                <li><strong>Email Service:</strong> Resend</li>
                <li><strong>Status:</strong> Successfully Delivered</li>
                <li><strong>Configuration:</strong> Production Ready ✅</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #888; font-size: 14px;">
                This email was sent automatically by your Fleet Management System.<br>
                If you received this email, your email configuration is working perfectly!
              </p>
            </div>
          </div>
        </div>
      `;
      
    case 'alert':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc3545; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Fleet Alert</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #dc3545; margin-top: 0;">${data.alertTitle || 'Fleet Alert'}</h2>
            <p style="color: #666; line-height: 1.6;">
              ${data.alertMessage || 'An important alert has been triggered in your fleet management system.'}
            </p>
            
            ${data.vehicleInfo ? `
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Vehicle Information:</h3>
                <ul style="color: #666; line-height: 1.8;">
                  <li><strong>Vehicle ID:</strong> ${data.vehicleInfo.id}</li>
                  <li><strong>License Plate:</strong> ${data.vehicleInfo.plate}</li>
                  <li><strong>Location:</strong> ${data.vehicleInfo.location}</li>
                  <li><strong>Timestamp:</strong> ${data.vehicleInfo.timestamp}</li>
                </ul>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${data.dashboardUrl || '#'}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Dashboard
              </a>
            </div>
          </div>
        </div>
      `;
      
    case 'report':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📊 Fleet Report</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">${data.reportPeriod || 'Weekly Report'}</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #28a745; margin-top: 0;">${data.reportTitle || 'Fleet Performance Report'}</h2>
            
            ${data.summary ? `
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">Summary:</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                  ${data.summary.totalVehicles ? `<div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 6px;"><div style="font-size: 24px; font-weight: bold; color: #28a745;">${data.summary.totalVehicles}</div><div style="color: #666; font-size: 14px;">Total Vehicles</div></div>` : ''}
                  ${data.summary.totalDistance ? `<div style="text-align: center; padding: 15px; background: #e3f2fd; border-radius: 6px;"><div style="font-size: 24px; font-weight: bold; color: #1976d2;">${data.summary.totalDistance}</div><div style="color: #666; font-size: 14px;">Distance (km)</div></div>` : ''}
                  ${data.summary.avgFuelConsumption ? `<div style="text-align: center; padding: 15px; background: #fff3e0; border-radius: 6px;"><div style="font-size: 24px; font-weight: bold; color: #f57c00;">${data.summary.avgFuelConsumption}</div><div style="color: #666; font-size: 14px;">Avg Fuel (L/100km)</div></div>` : ''}
                </div>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${data.reportUrl || '#'}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Full Report
              </a>
            </div>
          </div>
        </div>
      `;
      
    default:
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #007bff; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Fleet Management System</h1>
          </div>
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <p style="color: #666; line-height: 1.6;">
              ${data.message || 'This is a notification from your Fleet Management System.'}
            </p>
          </div>
        </div>
      `;
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, from, replyTo, template, data, html }: EmailRequest = await req.json();

    // Validate required fields
    if (!to || !subject) {
      throw new Error("Missing required fields: 'to' and 'subject' are required");
    }

    // Generate HTML content
    let emailHtml = html;
    if (!emailHtml && template) {
      emailHtml = getEmailTemplate(template, data || {});
    }
    
    if (!emailHtml) {
      emailHtml = `<p>${data?.message || 'Fleet Management System Notification'}</p>`;
    }

    // Send email using Resend
    const emailResponse = await resend.emails.send({
      from: from || "Fleet Management <fleet@yourdomain.com>",
      to: Array.isArray(to) ? to : [to],
      subject,
      replyTo: replyTo,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the email to database for tracking
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabaseClient
      .from('email_logs')
      .insert({
        recipient_email: Array.isArray(to) ? to[0] : to,
        subject,
        content: emailHtml,
        delivery_status: 'sent',
        provider_used: 'resend',
        provider_response: emailResponse,
        sent_at: new Date().toISOString()
      });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    
    // Log failed email attempt
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const body = await req.json().catch(() => ({}));
      
      await supabaseClient
        .from('email_logs')
        .insert({
          recipient_email: body.to || 'unknown',
          subject: body.subject || 'unknown',
          delivery_status: 'failed',
          error_message: error.message,
          provider_used: 'resend'
        });
    } catch (logError) {
      console.error("Failed to log email error:", logError);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);