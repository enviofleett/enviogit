import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  Send, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  Settings,
  Users,
  Bell,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const EmailConfigurationPanel = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [emailConfig, setEmailConfig] = useState({
    fromEmail: 'fleet@yourdomain.com',
    fromName: 'Fleet Management System',
    replyTo: 'noreply@yourdomain.com',
    testEmail: ''
  });
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<any>(null);
  const [emailPreferences, setEmailPreferences] = useState({
    alertEmails: true,
    reportEmails: true,
    maintenanceAlerts: true,
    geofenceAlerts: true,
    driverNotifications: true,
    weeklyReports: false,
    monthlyReports: false,
    marketingEmails: false
  });

  const { toast } = useToast();

  useEffect(() => {
    loadEmailTemplates();
    loadEmailPreferences();
  }, []);

  const loadEmailTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEmailTemplates(data || []);
    } catch (error) {
      console.error('Failed to load email templates:', error);
    }
  };

  const loadEmailPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('email_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setEmailPreferences({
          alertEmails: data.alert_emails,
          reportEmails: data.report_emails,  
          maintenanceAlerts: data.maintenance_alerts,
          geofenceAlerts: data.geofence_alerts,
          driverNotifications: data.driver_notifications,
          weeklyReports: data.weekly_reports,
          monthlyReports: data.monthly_reports,
          marketingEmails: data.marketing_emails
        });
      }
    } catch (error) {
      console.error('Failed to load email preferences:', error);
    }
  };

  const saveEmailPreferences = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('email_preferences')
        .upsert({
          user_id: user.id,
          alert_emails: emailPreferences.alertEmails,
          report_emails: emailPreferences.reportEmails,
          maintenance_alerts: emailPreferences.maintenanceAlerts,
          geofence_alerts: emailPreferences.geofenceAlerts,
          driver_notifications: emailPreferences.driverNotifications,
          weekly_reports: emailPreferences.weeklyReports,
          monthly_reports: emailPreferences.monthlyReports,
          marketing_emails: emailPreferences.marketingEmails
        });

      if (error) throw error;

      toast({
        title: "Email Preferences Saved",
        description: "Your email notification preferences have been updated successfully.",
      });
    } catch (error) {
      console.error('Failed to save email preferences:', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : 'Failed to save email preferences',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testEmailSending = async () => {
    if (!emailConfig.testEmail) {
      toast({
        title: "Missing Email",
        description: "Please enter a test email address",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: emailConfig.testEmail,
          subject: 'Fleet Management System - Email Test',
          from: `${emailConfig.fromName} <${emailConfig.fromEmail}>`,
          replyTo: emailConfig.replyTo,
          template: 'test',
          data: {
            testMessage: 'This is a test email from your Fleet Management System. Email configuration is working correctly!',
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      setTestResult({
        success: true,
        message: 'Test email sent successfully!',
        details: data
      });

      toast({
        title: "Email Test Successful",
        description: `Test email sent to ${emailConfig.testEmail}`,
      });
    } catch (error) {
      console.error('Email test failed:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Email test failed',
        error: error
      });

      toast({
        title: "Email Test Failed",
        description: error instanceof Error ? error.message : 'Email test failed',
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const PreferenceToggle = ({ 
    label, 
    description, 
    checked, 
    onChange, 
    icon: Icon 
  }: { 
    label: string; 
    description: string; 
    checked: boolean; 
    onChange: (checked: boolean) => void;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={checked ? 'default' : 'secondary'}>
          {checked ? 'Enabled' : 'Disabled'}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(!checked)}
        >
          {checked ? 'Disable' : 'Enable'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Configuration & Testing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-email">From Email Address</Label>
              <Input
                id="from-email"
                type="email"
                value={emailConfig.fromEmail}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                placeholder="fleet@yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">
                Must be a verified domain in Resend
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="from-name">From Name</Label>
              <Input
                id="from-name"
                value={emailConfig.fromName}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, fromName: e.target.value }))}
                placeholder="Fleet Management System"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reply-to">Reply-To Email</Label>
              <Input
                id="reply-to"
                type="email"
                value={emailConfig.replyTo}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, replyTo: e.target.value }))}
                placeholder="noreply@yourdomain.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="test-email">Test Email Address</Label>
              <Input
                id="test-email"
                type="email"
                value={emailConfig.testEmail}
                onChange={(e) => setEmailConfig(prev => ({ ...prev, testEmail: e.target.value }))}
                placeholder="test@example.com"
              />
            </div>
          </div>

          <Button 
            onClick={testEmailSending}
            disabled={isTesting || !emailConfig.testEmail}
            className="flex items-center gap-2"
          >
            <Send className={`h-4 w-4 ${isTesting ? 'animate-pulse' : ''}`} />
            {isTesting ? 'Sending Test Email...' : 'Send Test Email'}
          </Button>

          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">
                    Email Test {testResult.success ? 'Successful' : 'Failed'}
                  </div>
                  <div className="text-sm">{testResult.message}</div>
                  {testResult.details && (
                    <div className="text-xs bg-muted p-2 rounded">
                      <pre>{JSON.stringify(testResult.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PreferenceToggle
            icon={AlertTriangle}
            label="Alert Emails"
            description="Receive instant notifications for system alerts and critical events"
            checked={emailPreferences.alertEmails}
            onChange={(checked) => setEmailPreferences(prev => ({ ...prev, alertEmails: checked }))}
          />

          <PreferenceToggle
            icon={Shield}
            label="Geofence Alerts"
            description="Get notified when vehicles enter or exit geofenced areas"
            checked={emailPreferences.geofenceAlerts}
            onChange={(checked) => setEmailPreferences(prev => ({ ...prev, geofenceAlerts: checked }))}
          />

          <PreferenceToggle
            icon={Settings}
            label="Maintenance Alerts"
            description="Receive notifications for scheduled maintenance and service reminders"
            checked={emailPreferences.maintenanceAlerts}
            onChange={(checked) => setEmailPreferences(prev => ({ ...prev, maintenanceAlerts: checked }))}
          />

          <PreferenceToggle
            icon={Users}
            label="Driver Notifications"
            description="Get updates about driver activities and behavior reports"
            checked={emailPreferences.driverNotifications}
            onChange={(checked) => setEmailPreferences(prev => ({ ...prev, driverNotifications: checked }))}
          />

          <PreferenceToggle
            icon={Mail}
            label="Report Emails"
            description="Receive detailed fleet operation reports and analytics"
            checked={emailPreferences.reportEmails}
            onChange={(checked) => setEmailPreferences(prev => ({ ...prev, reportEmails: checked }))}
          />

          <PreferenceToggle
            icon={RefreshCw}
            label="Weekly Reports"
            description="Get comprehensive weekly summaries of fleet activity"
            checked={emailPreferences.weeklyReports}
            onChange={(checked) => setEmailPreferences(prev => ({ ...prev, weeklyReports: checked }))}
          />

          <PreferenceToggle
            icon={RefreshCw}
            label="Monthly Reports"
            description="Receive detailed monthly analytics and performance reports"
            checked={emailPreferences.monthlyReports}
            onChange={(checked) => setEmailPreferences(prev => ({ ...prev, monthlyReports: checked }))}
          />

          <div className="pt-4 border-t">
            <Button 
              onClick={saveEmailPreferences}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Settings className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {emailTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Templates ({emailTemplates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {emailTemplates.map((template) => (
                <div key={template.id} className="border rounded-lg p-4">
                  <div className="font-medium">{template.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {template.template_type.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Subject: {template.subject_template}
                  </div>
                  <Badge variant="outline" className="mt-2">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};