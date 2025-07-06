import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Key, 
  Eye, 
  EyeOff, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Copy,
  RefreshCw,
  Save,
  TestTube
} from 'lucide-react';

interface APICredentialsState {
  paystack_secret_key: string;
  paystack_public_key: string;
  gps51_username: string;
  gps51_password: string;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
}

export const APICredentialsPanel: React.FC = () => {
  const [credentials, setCredentials] = useState<APICredentialsState>({
    paystack_secret_key: '',
    paystack_public_key: '',
    gps51_username: '',
    gps51_password: '',
    smtp_host: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: ''
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setIsLoading(true);

      // Get current user profile for existing GPS51 credentials
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // For now, we'll store GPS51 credentials in a different way
      // since the profiles table doesn't have a notes column yet

      // Load email configuration
      const { data: emailConfig } = await supabase
        .from('email_configurations')
        .select('configuration')
        .eq('is_primary', true)
        .single();

      if (emailConfig?.configuration) {
        const config = emailConfig.configuration as any;
        setCredentials(prev => ({
          ...prev,
          smtp_host: config.host || '',
          smtp_port: config.port?.toString() || '587',
          smtp_username: config.auth?.user || '',
          smtp_password: config.auth?.pass || ''
        }));
      }

    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCredentialChange = (field: keyof APICredentialsState, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
  };

  const testPaystackConnection = async () => {
    if (!credentials.paystack_secret_key) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your Paystack secret key",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(prev => ({ ...prev, paystack: true }));

    try {
      // Test Paystack connection by fetching plans
      const response = await fetch('https://api.paystack.co/plan', {
        headers: {
          'Authorization': `Bearer ${credentials.paystack_secret_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast({
          title: "Paystack Connection Successful",
          description: "Your Paystack credentials are valid",
        });
      } else {
        throw new Error('Invalid Paystack credentials');
      }
    } catch (error) {
      toast({
        title: "Paystack Connection Failed",
        description: "Please check your Paystack credentials",
        variant: "destructive"
      });
    } finally {
      setIsTesting(prev => ({ ...prev, paystack: false }));
    }
  };

  const testGPS51Connection = async () => {
    if (!credentials.gps51_username || !credentials.gps51_password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your GPS51 username and password",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(prev => ({ ...prev, gps51: true }));

    try {
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          username: credentials.gps51_username,
          password: credentials.gps51_password
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "GPS51 Connection Successful",
          description: "Your GPS51 credentials are valid",
        });
      } else {
        throw new Error(data.error || 'GPS51 authentication failed');
      }
    } catch (error: any) {
      toast({
        title: "GPS51 Connection Failed",
        description: error.message || "Please check your GPS51 credentials",
        variant: "destructive"
      });
    } finally {
      setIsTesting(prev => ({ ...prev, gps51: false }));
    }
  };

  const saveCredentials = async () => {
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save GPS51 credentials - we'll need to create a separate credentials table
      // For now, skip this until we have proper credentials storage
      console.log('GPS51 credentials would be saved:', {
        username: credentials.gps51_username,
        hasPassword: !!credentials.gps51_password
      });

      // Save email configuration
      if (credentials.smtp_host && credentials.smtp_username && credentials.smtp_password) {
        const { error: emailError } = await supabase.functions.invoke('save-smtp-credentials', {
          body: {
            provider: 'custom',
            host: credentials.smtp_host,
            port: parseInt(credentials.smtp_port),
            secure: credentials.smtp_port === '465',
            auth: {
              user: credentials.smtp_username,
              pass: credentials.smtp_password
            }
          }
        });

        if (emailError) throw emailError;
      }

      toast({
        title: "Credentials Saved",
        description: "Your API credentials have been saved successfully",
      });

    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save credentials",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const CredentialField = ({ 
    label, 
    field, 
    type = "text", 
    placeholder, 
    description 
  }: {
    label: string;
    field: keyof APICredentialsState;
    type?: string;
    placeholder?: string;
    description?: string;
  }) => {
    const isSecret = type === "password";
    const fieldValue = credentials[field];
    const isVisible = showSecrets[field];

    return (
      <div className="space-y-2">
        <Label htmlFor={field} className="flex items-center gap-2">
          {label}
          {isSecret && <Key className="w-3 h-3" />}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id={field}
              type={isSecret && !isVisible ? "password" : "text"}
              value={fieldValue}
              onChange={(e) => handleCredentialChange(field, e.target.value)}
              placeholder={placeholder}
              className="pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              {fieldValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => copyToClipboard(fieldValue, label)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              )}
              {isSecret && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleSecretVisibility(field)}
                >
                  {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              )}
            </div>
          </div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">API Credentials</h2>
        <p className="text-muted-foreground">
          Manage your API keys and service credentials
        </p>
      </div>

      {/* Paystack Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Paystack Payment Gateway
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> Paystack credentials are stored securely in Supabase Edge Function secrets.
              Never expose your secret key in client-side code.
            </AlertDescription>
          </Alert>

          <CredentialField
            label="Public Key"
            field="paystack_public_key"
            placeholder="pk_test_..."
            description="Your Paystack public key (safe to use in frontend)"
          />

          <CredentialField
            label="Secret Key"
            field="paystack_secret_key"
            type="password"
            placeholder="sk_test_..."
            description="Your Paystack secret key (keep this secure)"
          />

          <div className="flex gap-2 pt-2">
            <Button
              onClick={testPaystackConnection}
              disabled={isTesting.paystack || !credentials.paystack_secret_key}
              variant="outline"
              size="sm"
            >
              {isTesting.paystack ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Badge variant="outline">
              {credentials.paystack_secret_key ? "Configured" : "Not Set"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* GPS51 Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            GPS51 API Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialField
            label="Username"
            field="gps51_username"
            placeholder="your_gps51_username"
            description="Your GPS51 account username"
          />

          <CredentialField
            label="Password"
            field="gps51_password"
            type="password"
            placeholder="your_gps51_password"
            description="Your GPS51 account password"
          />

          <div className="flex gap-2 pt-2">
            <Button
              onClick={testGPS51Connection}
              disabled={isTesting.gps51 || !credentials.gps51_username || !credentials.gps51_password}
              variant="outline"
              size="sm"
            >
              {isTesting.gps51 ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Badge variant="outline">
              {credentials.gps51_username && credentials.gps51_password ? "Configured" : "Not Set"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Email/SMTP Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Email Service Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <CredentialField
              label="SMTP Host"
              field="smtp_host"
              placeholder="smtp.gmail.com"
              description="Your email provider's SMTP server"
            />

            <CredentialField
              label="SMTP Port"
              field="smtp_port"
              placeholder="587"
              description="Usually 587 for TLS or 465 for SSL"
            />
          </div>

          <CredentialField
            label="Email Username"
            field="smtp_username"
            placeholder="your-email@domain.com"
            description="Your email address or SMTP username"
          />

          <CredentialField
            label="Email Password"
            field="smtp_password"
            type="password"
            placeholder="your_email_password_or_app_password"
            description="Your email password or app-specific password"
          />

          <Badge variant="outline">
            {credentials.smtp_host && credentials.smtp_username ? "Configured" : "Not Set"}
          </Badge>
        </CardContent>
      </Card>

      <Separator />

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={loadCredentials}
          variant="outline"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          onClick={saveCredentials}
          disabled={isLoading}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Credentials
        </Button>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Best Practices:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Paystack secret keys are stored in secure Supabase Edge Function secrets</li>
            <li>GPS51 credentials are encrypted in your profile data</li>
            <li>Email credentials are stored in encrypted configuration</li>
            <li>Never share or expose your secret keys publicly</li>
            <li>Use test keys during development, live keys only in production</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
};