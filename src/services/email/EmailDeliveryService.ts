// Email Delivery Service - Core email sending functionality for Envio Fleet Management
import { supabase } from '@/integrations/supabase/client';

export interface EmailProvider {
  name: string;
  isActive: boolean;
  isPrimary: boolean;
  send: (params: EmailSendParams) => Promise<EmailDeliveryResult>;
}

export interface EmailSendParams {
  to: string;
  subject: string;
  content: string;
  template_id?: string;
  metadata?: Record<string, any>;
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export class EmailDeliveryService {
  private providers: Map<string, EmailProvider> = new Map();
  private fallbackProviders: string[] = [];

  /**
   * Register an email provider
   */
  registerProvider(provider: EmailProvider): void {
    this.providers.set(provider.name, provider);
    if (provider.isPrimary) {
      this.fallbackProviders.unshift(provider.name);
    } else {
      this.fallbackProviders.push(provider.name);
    }
  }

  /**
   * Send email with automatic fallback
   */
  async sendEmail(params: EmailSendParams): Promise<EmailDeliveryResult> {
    const logData = {
      recipient_email: params.to,
      subject: params.subject,
      content: params.content,
      template_id: params.template_id,
      delivery_status: 'pending' as const,
      created_at: new Date().toISOString()
    };

    try {
      // Log email attempt
      const { data: emailLog } = await supabase
        .from('email_logs')
        .insert(logData)
        .select()
        .single();

      const emailLogId = emailLog?.id;

      // Try each provider in order
      for (const providerName of this.fallbackProviders) {
        const provider = this.providers.get(providerName);
        if (!provider?.isActive) continue;

        try {
          console.log(`Attempting to send email via ${providerName}`);
          const result = await provider.send(params);

          if (result.success) {
            // Update log with success
            if (emailLogId) {
              await supabase
                .from('email_logs')
                .update({
                  delivery_status: 'sent',
                  provider_used: providerName,
                  sent_at: new Date().toISOString(),
                  provider_response: { messageId: result.messageId }
                })
                .eq('id', emailLogId);
            }

            console.log(`Email sent successfully via ${providerName}`);
            return result;
          }
        } catch (error) {
          console.warn(`Provider ${providerName} failed:`, error);
          
          // Update log with provider failure
          if (emailLogId) {
            await supabase
              .from('email_logs')
              .update({
                error_message: error instanceof Error ? error.message : 'Provider failed',
                retry_count: 1
              })
              .eq('id', emailLogId);
          }
          
          continue; // Try next provider
        }
      }

      // All providers failed
      const finalError = 'All email providers failed';
      
      if (emailLogId) {
        await supabase
          .from('email_logs')
          .update({
            delivery_status: 'failed',
            error_message: finalError
          })
          .eq('id', emailLogId);
      }

      return {
        success: false,
        error: finalError,
        provider: 'none'
      };

    } catch (error) {
      console.error('Email delivery service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'none'
      };
    }
  }

  /**
   * Get active providers
   */
  getActiveProviders(): EmailProvider[] {
    return Array.from(this.providers.values()).filter(p => p.isActive);
  }

  /**
   * Set primary provider
   */
  setPrimaryProvider(providerName: string): void {
    // Remove from current position
    const index = this.fallbackProviders.indexOf(providerName);
    if (index > -1) {
      this.fallbackProviders.splice(index, 1);
    }
    
    // Add to front
    this.fallbackProviders.unshift(providerName);
    
    // Update provider settings
    this.providers.forEach((provider, name) => {
      provider.isPrimary = name === providerName;
    });
  }

  /**
   * Test email delivery
   */
  async testDelivery(providerName: string, testEmail: string): Promise<EmailDeliveryResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        success: false,
        error: `Provider ${providerName} not found`,
        provider: providerName
      };
    }

    return await provider.send({
      to: testEmail,
      subject: 'Test Email from Envio Fleet Management',
      content: '<h1>Test Email</h1><p>This is a test email to verify email delivery is working correctly.</p>'
    });
  }
}

// Singleton instance
export const emailDeliveryService = new EmailDeliveryService();