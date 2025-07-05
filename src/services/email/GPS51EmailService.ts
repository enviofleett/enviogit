// GPS51 Email Service - Main email orchestration service for Envio Fleet Management
import { supabase } from '@/integrations/supabase/client';
import { EmailTemplateService } from './EmailTemplateService';
import { EmailDeliveryService } from './EmailDeliveryService';
import { gps51EventBus } from '../gps51/realtime';

export interface EmailContext {
  userId?: string;
  vehicleId?: string;
  deviceId?: string;
  alertId?: string;
  templateData?: Record<string, any>;
}

export interface SendEmailRequest {
  recipients: string[];
  templateName: string;
  context: EmailContext;
  priority?: 'high' | 'normal' | 'low';
  scheduledFor?: Date;
}

export interface EmailStatus {
  success: boolean;
  emailLogId?: string;
  error?: string;
  provider?: string;
}

export class GPS51EmailService {
  private static instance: GPS51EmailService;
  private templateService: EmailTemplateService;
  private deliveryService: EmailDeliveryService;

  constructor() {
    this.templateService = new EmailTemplateService();
    this.deliveryService = new EmailDeliveryService();
    this.setupEventListeners();
  }

  static getInstance(): GPS51EmailService {
    if (!GPS51EmailService.instance) {
      GPS51EmailService.instance = new GPS51EmailService();
    }
    return GPS51EmailService.instance;
  }

  /**
   * Send email using template and context data
   */
  async sendEmail(request: SendEmailRequest): Promise<EmailStatus[]> {
    const results: EmailStatus[] = [];
    
    try {
      // Get email template
      const template = await this.templateService.getTemplate(request.templateName);
      if (!template) {
        throw new Error(`Email template '${request.templateName}' not found`);
      }

      // Check user email preferences for each recipient
      const validRecipients = await this.filterRecipientsByPreferences(
        request.recipients, 
        template.template_type,
        request.context.userId
      );

      if (validRecipients.length === 0) {
        return [{
          success: false,
          error: 'No valid recipients after preference filtering'
        }];
      }

      // Render email content
      const renderedContent = await this.templateService.renderTemplate(
        template,
        request.context.templateData || {}
      );

      // Send emails
      for (const recipient of validRecipients) {
        try {
          // Create email log entry
          const { data: emailLog, error: logError } = await supabase
            .from('email_logs')
            .insert({
              recipient_email: recipient,
              template_id: template.id,
              alert_id: request.context.alertId,
              vehicle_id: request.context.vehicleId,
              device_id: request.context.deviceId,
              user_id: request.context.userId,
              subject: renderedContent.subject,
              content: renderedContent.body,
              delivery_status: 'pending'
            })
            .select()
            .single();

          if (logError) {
            console.error('GPS51EmailService: Error creating email log:', logError);
            results.push({
              success: false,
              error: `Failed to create email log: ${logError.message}`
            });
            continue;
          }

          const deliveryResult = await this.deliveryService.sendEmail({
            to: recipient,
            subject: renderedContent.subject,
            content: renderedContent.body,
            metadata: { priority: request.priority || 'normal' }
          });

          // Update email log with delivery status
          await supabase
            .from('email_logs')
            .update({
              delivery_status: deliveryResult.success ? 'sent' : 'failed',
              provider_used: deliveryResult.provider,
              provider_response: { messageId: deliveryResult.messageId },
              error_message: deliveryResult.error,
              sent_at: deliveryResult.success ? new Date().toISOString() : null
            })
            .eq('id', emailLog.id);

          results.push({
            success: deliveryResult.success,
            emailLogId: emailLog.id,
            error: deliveryResult.error,
            provider: deliveryResult.provider
          });

        } catch (error) {
          console.error('GPS51EmailService: Error sending email to', recipient, error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return results;

    } catch (error) {
      console.error('GPS51EmailService: Error in sendEmail:', error);
      return [{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }];
    }
  }

  /**
   * Send welcome email for new user registration
   */
  async sendWelcomeEmail(user: { id: string; email?: string; user_metadata?: any }): Promise<EmailStatus> {
    if (!user.email) {
      return { success: false, error: 'User email not provided' };
    }

    const result = await this.sendEmail({
      recipients: [user.email],
      templateName: 'welcome_email',
      context: {
        userId: user.id,
        templateData: {
          user_name: user.user_metadata?.name || user.email.split('@')[0],
          user_email: user.email
        }
      },
      priority: 'high'
    });

    return result[0] || { success: false, error: 'No result returned' };
  }

  /**
   * Send alert email for GPS51 events
   */
  async sendAlertEmail(alertData: {
    alert: any;
    recipients: string[];
    template?: string;
    vehicleData?: any;
    gps51Data?: any;
  }): Promise<EmailStatus[]> {
    const templateName = alertData.template || this.getAlertTemplateName(alertData.alert.type);
    
    return await this.sendEmail({
      recipients: alertData.recipients,
      templateName,
      context: {
        userId: alertData.alert.userId,
        vehicleId: alertData.alert.vehicleId,
        deviceId: alertData.alert.deviceId,
        alertId: alertData.alert.id,
        templateData: {
          ...alertData.alert,
          ...alertData.vehicleData,
          ...alertData.gps51Data,
          alert_time: new Date(alertData.alert.createdAt).toLocaleString(),
          location: alertData.alert.location ? 
            `${alertData.alert.location.lat}, ${alertData.alert.location.lng}` : 
            'Unknown'
        }
      },
      priority: alertData.alert.severity === 'critical' ? 'high' : 'normal'
    });
  }

  /**
   * Send geofence violation email
   */
  async sendGeofenceAlert(data: {
    vehicle: any;
    geofence: any;
    violation: any;
    recipients: string[];
  }): Promise<EmailStatus[]> {
    return await this.sendEmail({
      recipients: data.recipients,
      templateName: 'geofence_alert',
      context: {
        vehicleId: data.vehicle.id,
        templateData: {
          vehicle_name: data.vehicle.name || data.vehicle.id,
          violation_type: data.violation.type === 'enter' ? 'entered' : 'exited',
          geofence_name: data.geofence.name,
          alert_time: new Date().toLocaleString(),
          location: data.violation.location ? 
            `${data.violation.location.lat}, ${data.violation.location.lng}` : 
            'Unknown'
        }
      },
      priority: 'high'
    });
  }

  /**
   * Send maintenance alert email
   */
  async sendMaintenanceAlert(data: {
    vehicle: any;
    maintenanceType: string;
    dueDate?: string;
    currentMileage?: number;
    recipients: string[];
  }): Promise<EmailStatus[]> {
    return await this.sendEmail({
      recipients: data.recipients,
      templateName: 'maintenance_alert',
      context: {
        vehicleId: data.vehicle.id,
        templateData: {
          vehicle_name: data.vehicle.name || data.vehicle.id,
          maintenance_type: data.maintenanceType,
          due_date: data.dueDate || 'Not specified',
          current_mileage: data.currentMileage ? `${data.currentMileage} km` : 'Unknown'
        }
      },
      priority: 'normal'
    });
  }

  /**
   * Send weekly fleet report
   */
  async sendWeeklyReport(data: {
    weekEnding: string;
    totalVehicles: number;
    activeVehicles: number;
    totalDistance: number;
    totalAlerts: number;
    recipients: string[];
  }): Promise<EmailStatus[]> {
    return await this.sendEmail({
      recipients: data.recipients,
      templateName: 'weekly_report',
      context: {
        templateData: {
          week_ending: data.weekEnding,
          total_vehicles: data.totalVehicles,
          active_vehicles: data.activeVehicles,
          total_distance: data.totalDistance,
          total_alerts: data.totalAlerts
        }
      },
      priority: 'low'
    });
  }

  /**
   * Filter recipients based on their email preferences
   */
  private async filterRecipientsByPreferences(
    recipients: string[], 
    templateType: string,
    userId?: string
  ): Promise<string[]> {
    try {
      // Get email preferences for users
      const { data: preferences, error } = await supabase
        .from('email_preferences')
        .select('*')
        .in('user_id', recipients.includes('@') ? [] : recipients); // Only if recipients are user IDs

      if (error) {
        console.warn('GPS51EmailService: Error fetching email preferences:', error);
        return recipients; // Return all recipients if preferences can't be checked
      }

      // Filter based on template type and preferences
      return recipients.filter(recipient => {
        if (recipient.includes('@')) {
          return true; // Email addresses are always valid
        }

        const userPrefs = preferences?.find(p => p.user_id === recipient);
        if (!userPrefs) {
          return true; // If no preferences found, allow sending
        }

        // Check preferences based on template type
        switch (templateType) {
          case 'alert':
            return userPrefs.alert_emails;
          case 'report':
            return userPrefs.report_emails;
          case 'registration':
          case 'password_reset':
          case 'account_update':
            return true; // Always send critical emails
          default:
            return userPrefs.alert_emails;
        }
      });

    } catch (error) {
      console.warn('GPS51EmailService: Error filtering recipients:', error);
      return recipients;
    }
  }

  /**
   * Get appropriate template name for alert type
   */
  private getAlertTemplateName(alertType: string): string {
    switch (alertType) {
      case 'geofence':
        return 'geofence_alert';
      case 'maintenance':
        return 'maintenance_alert';
      case 'speed':
        return 'speed_alert';
      case 'battery':
        return 'battery_alert';
      case 'panic':
        return 'panic_alert';
      default:
        return 'generic_alert';
    }
  }

  /**
   * Setup event listeners for GPS51 events
   */
  private setupEventListeners(): void {
    // Listen for GPS51 alert events
    gps51EventBus.on('gps51.alert.created', async (event) => {
      try {
        // Get recipients for this alert (this would be customizable)
        const recipients = await this.getAlertRecipients(event.data);
        
        if (recipients.length > 0) {
          await this.sendAlertEmail({
            alert: event.data,
            recipients,
            vehicleData: event.metadata?.vehicleData || {},
            gps51Data: event.metadata?.gps51Data || {}
          });
        }
      } catch (error) {
        console.error('GPS51EmailService: Error handling alert event:', error);
      }
    });

    // Listen for geofence events
    gps51EventBus.on('gps51.geofence.violation', async (event) => {
      try {
        const recipients = await this.getGeofenceAlertRecipients(event.data);
        
        if (recipients.length > 0) {
          await this.sendGeofenceAlert({
            vehicle: event.data.vehicle,
            geofence: event.data.geofence,
            violation: event.data.violation,
            recipients
          });
        }
      } catch (error) {
        console.error('GPS51EmailService: Error handling geofence event:', error);
      }
    });
  }

  /**
   * Get recipients for alert notifications
   */
  private async getAlertRecipients(alertData: any): Promise<string[]> {
    // This is a simplified implementation
    // In production, this would be more sophisticated based on:
    // - Vehicle ownership
    // - Fleet management hierarchy
    // - Alert severity
    // - User roles and permissions
    
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'admin')
        .not('email', 'is', null);

      if (error) {
        console.error('GPS51EmailService: Error fetching alert recipients:', error);
        return [];
      }

      return profiles?.map(p => p.email).filter(Boolean) || [];

    } catch (error) {
      console.error('GPS51EmailService: Error getting alert recipients:', error);
      return [];
    }
  }

  /**
   * Get recipients for geofence alert notifications
   */
  private async getGeofenceAlertRecipients(data: any): Promise<string[]> {
    // Similar to getAlertRecipients but specific to geofence events
    return await this.getAlertRecipients(data);
  }

  /**
   * Get email sending statistics
   */
  async getEmailStats(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    total: number;
    sent: number;
    failed: number;
    delivered: number;
    opened: number;
    byType: Record<string, number>;
  }> {
    try {
      const cutoffDate = new Date();
      switch (timeframe) {
        case 'day':
          cutoffDate.setDate(cutoffDate.getDate() - 1);
          break;
        case 'week':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
      }

      const { data: logs, error } = await supabase
        .from('email_logs')
        .select(`
          delivery_status,
          email_templates (
            template_type
          )
        `)
        .gte('created_at', cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      const stats = {
        total: logs?.length || 0,
        sent: 0,
        failed: 0,
        delivered: 0,
        opened: 0,
        byType: {} as Record<string, number>
      };

      logs?.forEach(log => {
        switch (log.delivery_status) {
          case 'sent':
            stats.sent++;
            break;
          case 'failed':
            stats.failed++;
            break;
          case 'delivered':
            stats.delivered++;
            break;
          case 'opened':
            stats.opened++;
            break;
        }

        const templateType = (log.email_templates as any)?.template_type;
        if (templateType) {
          stats.byType[templateType] = (stats.byType[templateType] || 0) + 1;
        }
      });

      return stats;

    } catch (error) {
      console.error('GPS51EmailService: Error getting email stats:', error);
      return {
        total: 0,
        sent: 0,
        failed: 0,
        delivered: 0,
        opened: 0,
        byType: {}
      };
    }
  }
}

// Create singleton instance
export const gps51EmailService = GPS51EmailService.getInstance();