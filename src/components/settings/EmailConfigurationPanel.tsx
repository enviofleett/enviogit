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
  const [smtpConfig, setSmtpConfig] = useState({
    provider: 'custom',
    host: '',
    port: '587',
    username: '',
    password: '',
    secure: false,
    enabled: false
  });
  const [emailProvider, setEmailProvider] = useState<'resend' | 'smtp'>('resend');
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
    loadEmailConfiguration();
  }, []);

  const loadEmailConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('email_configurations')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data && data.configuration) {
        const config = data.configuration as any;
        if (config.provider === 'smtp' && config.smtp) {
          setSmtpConfig({
            provider: config.smtp.provider || 'custom',
            host: config.smtp.host || '',
            port: config.smtp.port || '587',
            username: config.smtp.username || '',
            password: '', // Never load password from storage
            secure: config.smtp.secure || false,
            enabled: true
          });
          setEmailProvider('smtp');
        }
        if (config.email) {
          setEmailConfig(prev => ({
            ...prev,
            fromEmail: config.email.fromEmail || prev.fromEmail,
            fromName: config.email.fromName || prev.fromName,
            replyTo: config.email.replyTo || prev.replyTo
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load email configuration:', error);
    }
  };

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

  const saveEmailConfiguration = async () => {
    try {
      setIsLoading(true);
      
      const configuration = {
        provider: emailProvider,
        email: emailConfig,
        ...(emailProvider === 'smtp' && {
          smtp: {
            provider: smtpConfig.provider,
            host: smtpConfig.host,
            port: smtpConfig.port,
            username: smtpConfig.username,
            secure: smtpConfig.secure,
            enabled: smtpConfig.enabled
          }
        })
      };

      // Save configuration to database (without password)
      const { error } = await supabase
        .from('email_configurations')
        .upsert({
          provider_name: emailProvider,
          configuration,
          is_active: true,
          is_primary: true
        });

      if (error) throw error;

      // If SMTP is configured with password, save it securely via edge function
      if (emailProvider === 'smtp' && smtpConfig.password) {
        const { error: secretError } = await supabase.functions.invoke('save-smtp-credentials', {
          body: {
            host: smtpConfig.host,
            port: smtpConfig.port,
            username: smtpConfig.username,
            password: smtpConfig.password,
            secure: smtpConfig.secure
          }
        });
        
        if (secretError) {
          console.warn('Failed to save SMTP password securely:', secretError);
        }
      }

      toast({
        title: "Configuration Saved",
        description: `${emailProvider.toUpperCase()} email configuration has been saved successfully.`,
      });
    } catch (error) {
      console.error('Failed to save email configuration:', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : 'Failed to save email configuration',
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
          provider: emailProvider,
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
        description: `Test email sent to ${emailConfig.testEmail} via ${emailProvider.toUpperCase()}`,
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

  const populateSMTPPreset = (provider: string) => {
    const presets = {
      gmail: {
        host: 'smtp.gmail.com',
        port: '587',
        secure: false
      },
      outlook: {
        host: 'smtp.office365.com', 
        port: '587',
        secure: false
      },
      yahoo: {
        host: 'smtp.mail.yahoo.com',
        port: '587',
        secure: false
      },
      sendgrid: {
        host: 'smtp.sendgrid.net',
        port: '587',
        secure: false
      }
    };

    const preset = presets[provider as keyof typeof presets];
    if (preset) {
      setSmtpConfig(prev => ({
        ...prev,
        provider,
        host: preset.host,
        port: preset.port,
        secure: preset.secure
      }));
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
          {/* Email Provider Selection */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <Label className="text-base font-semibold">Email Provider</Label>
            <div className="grid grid-cols-2 gap-4">
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  emailProvider === 'resend' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                }`}
                onClick={() => setEmailProvider('resend')}
              >
                <div className="font-medium">Resend (Recommended)</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Modern email API with high deliverability
                </div>
                <Badge variant={emailProvider === 'resend' ? 'default' : 'outline'} className="mt-2">
                  {emailProvider === 'resend' ? 'Selected' : 'Available'}
                </Badge>
              </div>
              
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  emailProvider === 'smtp' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                }`}
                onClick={() => setEmailProvider('smtp')}
              >
                <div className="font-medium">SMTP</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Use your existing email provider
                </div>
                <Badge variant={emailProvider === 'smtp' ? 'default' : 'outline'} className="mt-2">
                  {emailProvider === 'smtp' ? 'Selected' : 'Available'}
                </Badge>
              </div>
            </div>
          </div>

          {/* SMTP Configuration */}
          {emailProvider === 'smtp' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">SMTP Configuration</Label>
                <Badge variant={smtpConfig.enabled ? 'default' : 'secondary'}>
                  {smtpConfig.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-provider">Provider Preset</Label>
                  <Select 
                    value={smtpConfig.provider} 
                    onValueChange={(value) => {
                      setSmtpConfig(prev => ({ ...prev, provider: value }));
                      if (value !== 'custom') {
                        populateSMTPPreset(value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom SMTP</SelectItem>
                      <SelectItem value="gmail">Gmail</SelectItem>
                      <SelectItem value="outlook">Outlook/Office365</SelectItem>
                      <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    value={smtpConfig.host}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Select 
                    value={smtpConfig.port} 
                    onValueChange={(value) => setSmtpConfig(prev => ({ 
                      ...prev, 
                      port: value,
                      secure: value === '465'
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="587">587 (TLS)</SelectItem>
                      <SelectItem value="465">465 (SSL)</SelectItem>
                      <SelectItem value="25">25 (Unsecured)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="smtp-username">Username</Label>
                  <Input
                    id="smtp-username"
                    value={smtpConfig.username}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="your-email@domain.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="smtp-password">Password</Label>
                  <Input
                    id="smtp-password"
                    type="password"
                    value={smtpConfig.password}
                    onChange={(e) => setSmtpConfig(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="App password or regular password"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="smtp-secure"
                  checked={smtpConfig.secure}
                  onChange={(e) => setSmtpConfig(prev => ({ ...prev, secure: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="smtp-secure">Use SSL/TLS Encryption</Label>
              </div>

              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">SMTP Setup Tips:</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li><strong>Gmail:</strong> Use app-specific password, not your regular password</li>
                      <li><strong>Outlook:</strong> Enable "Allow less secure apps" or use app password</li>
                      <li><strong>Port 587:</strong> STARTTLS (recommended for most providers)</li>
                      <li><strong>Port 465:</strong> SSL/TLS (legacy but still supported)</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

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

          <div className="flex gap-2">
            <Button 
              onClick={saveEmailConfiguration}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Settings className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </Button>
            
            <Button 
              onClick={testEmailSending}
              disabled={isTesting || !emailConfig.testEmail || (emailProvider === 'smtp' && (!smtpConfig.host || !smtpConfig.username))}
              className="flex items-center gap-2"
            >
              <Send className={`h-4 w-4 ${isTesting ? 'animate-pulse' : ''}`} />
              {isTesting ? 'Sending Test Email...' : `Test Email via ${emailProvider.toUpperCase()}`}
            </Button>
          </div>

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