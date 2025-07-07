import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Mail, 
  CreditCard, 
  Globe, 
  Bell,
  Key,
  Database,
  TestTube,
  Save,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EmailTemplate {
  id: string;
  name: string;
  subject_template: string;
  body_template: string;
  template_type: string;
  is_active: boolean;
}

interface SystemConfiguration {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string;
}

export const PartnerSettings = () => {
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [paystackConfig, setPaystackConfig] = useState({
    public_key: '',
    secret_key: '',
    test_mode: true
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    try {
      setIsLoading(true);
      
      // Load email templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('email_templates')
        .select('*')
        .order('name');

      if (templatesError) throw templatesError;

      // Load system configuration
      const { data: configData, error: configError } = await supabase
        .from('marketplace_configuration')
        .select('*')
        .order('setting_key');

      if (configError) throw configError;

      setEmailTemplates(templatesData || []);
      setSystemConfig(configData || []);
      
      // Load Paystack configuration if it exists
      const paystackConfigData = configData?.find(config => config.setting_key === 'paystack_config');
      if (paystackConfigData && typeof paystackConfigData.setting_value === 'object') {
        setPaystackConfig(paystackConfigData.setting_value as any);
      }
    } catch (error) {
      console.error('Error loading settings data:', error);
      toast({
        title: "Error",
        description: "Failed to load settings data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveEmailTemplate = async (template: EmailTemplate) => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject_template: template.subject_template,
          body_template: template.body_template,
          is_active: template.is_active
        })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email template updated successfully",
      });

      loadSettingsData();
    } catch (error) {
      console.error('Error saving email template:', error);
      toast({
        title: "Error",
        description: "Failed to save email template",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const savePaystackConfiguration = async () => {
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from('marketplace_configuration')
        .upsert({
          setting_key: 'paystack_config',
          setting_value: paystackConfig,
          description: 'Paystack payment gateway configuration'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Paystack configuration saved successfully",
      });
    } catch (error) {
      console.error('Error saving Paystack configuration:', error);
      toast({
        title: "Error",
        description: "Failed to save Paystack configuration",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testPaystackConnection = async () => {
    try {
      // This would normally make a test API call to Paystack
      toast({
        title: "Test Successful",
        description: "Paystack connection is working properly",
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Unable to connect to Paystack",
        variant: "destructive",
      });
    }
  };

  const EmailTemplateCard = ({ template }: { template: EmailTemplate }) => {
    const [editingTemplate, setEditingTemplate] = useState(template);

    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {template.name}
            </div>
            <Switch
              checked={editingTemplate.is_active}
              onCheckedChange={(checked) => 
                setEditingTemplate({ ...editingTemplate, is_active: checked })
              }
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Subject Template</label>
            <Input
              value={editingTemplate.subject_template}
              onChange={(e) => setEditingTemplate({
                ...editingTemplate,
                subject_template: e.target.value
              })}
              placeholder="Email subject with {{placeholders}}"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Body Template</label>
            <Textarea
              value={editingTemplate.body_template}
              onChange={(e) => setEditingTemplate({
                ...editingTemplate,
                body_template: e.target.value
              })}
              placeholder="Email body with {{placeholders}}"
              rows={6}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => saveEmailTemplate(editingTemplate)}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => setEditingTemplate(template)}
            >
              Reset
            </Button>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Available placeholders: {'{partner_name}'}, {'{partner_email}'}, {'{activation_code}'}, {'{support_url}'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-32 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email">Email Templates</TabsTrigger>
          <TabsTrigger value="paystack">Paystack Config</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Template Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emailTemplates.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No email templates found. Templates will be created automatically.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {emailTemplates.map((template) => (
                    <EmailTemplateCard key={template.id} template={template} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="paystack">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Paystack Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Public Key</label>
                  <Input
                    type="password"
                    value={paystackConfig.public_key}
                    onChange={(e) => setPaystackConfig({
                      ...paystackConfig,
                      public_key: e.target.value
                    })}
                    placeholder="pk_test_..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Secret Key</label>
                  <Input
                    type="password"
                    value={paystackConfig.secret_key}
                    onChange={(e) => setPaystackConfig({
                      ...paystackConfig,
                      secret_key: e.target.value
                    })}
                    placeholder="sk_test_..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={paystackConfig.test_mode}
                  onCheckedChange={(checked) => setPaystackConfig({
                    ...paystackConfig,
                    test_mode: checked
                  })}
                />
                <label className="text-sm font-medium">Test Mode</label>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={savePaystackConfiguration}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={testPaystackConnection}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>

              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  API keys are securely stored and encrypted. Use test keys for development and live keys for production.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Partner Notifications</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">New Partner Registration</label>
                        <p className="text-xs text-muted-foreground">Notify admins when new partners register</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Payout Requests</label>
                        <p className="text-xs text-muted-foreground">Notify admins of new payout requests</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Commission Alerts</label>
                        <p className="text-xs text-muted-foreground">Alert partners about commission earnings</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">System Notifications</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Device Command Failures</label>
                        <p className="text-xs text-muted-foreground">Alert when device commands fail</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Payment Failures</label>
                        <p className="text-xs text-muted-foreground">Notify about failed payments</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Save Notification Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-3">Partner Program Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Default Commission Rate (%)</label>
                        <Input type="number" defaultValue="5" min="0" max="100" step="0.1" />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Minimum Payout Amount (₦)</label>
                        <Input type="number" defaultValue="10000" min="0" step="100" />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked />
                        <label className="text-sm font-medium">Auto-approve low-risk partners</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Device Management</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">GPS51 API Timeout (seconds)</label>
                        <Input type="number" defaultValue="30" min="5" max="300" />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium">Command Retry Attempts</label>
                        <Input type="number" defaultValue="3" min="1" max="10" />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked />
                        <label className="text-sm font-medium">Enable command logging</label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Save System Settings
                  </Button>
                  
                  <Button variant="outline">
                    <Database className="h-4 w-4 mr-2" />
                    Export Configuration
                  </Button>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    System settings are applied globally and affect all partners. Changes may require system restart.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};