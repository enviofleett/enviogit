import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Key, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SecretsStatus {
  GPS51_API_URL: boolean;
  GPS51_USERNAME: boolean; 
  GPS51_PASSWORD_HASH: boolean;
}

export const GPS51SecretsSetup = () => {
  const [credentials, setCredentials] = useState({
    apiUrl: 'https://api.gps51.com/openapi',
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [secretsStatus, setSecretsStatus] = useState<SecretsStatus | null>(null);
  const { toast } = useToast();

  const checkSecretsStatus = async () => {
    try {
      console.log('🔐 Checking GPS51 secrets status...');
      
      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          username: '',
          password: '',
          apiUrl: '',
          cronTriggered: true,
          priority: 1
        }
      });

      if (error) {
        const errorMessage = error.message;
        const status: SecretsStatus = {
          GPS51_API_URL: !errorMessage.includes('API URL'),
          GPS51_USERNAME: !errorMessage.includes('Username'),
          GPS51_PASSWORD_HASH: !errorMessage.includes('Password')
        };
        setSecretsStatus(status);
        return status;
      }

      // If no error, all secrets are configured
      const status: SecretsStatus = {
        GPS51_API_URL: true,
        GPS51_USERNAME: true,
        GPS51_PASSWORD_HASH: true
      };
      setSecretsStatus(status);
      return status;
    } catch (error) {
      console.error('Error checking secrets:', error);
      return null;
    }
  };

  const testCredentials = async () => {
    setTesting(true);
    try {
      const { gps51UnifiedLiveDataService } = await import('@/services/gps51/GPS51UnifiedLiveDataService');
      
      // Test authentication with provided credentials
      await gps51UnifiedLiveDataService.authenticate(credentials.username, credentials.password);
      
      toast({
        title: 'Credentials Valid',
        description: 'GPS51 credentials are working correctly',
      });
      
      return true;
    } catch (error) {
      toast({
        title: 'Credentials Invalid',
        description: error instanceof Error ? error.message : 'Authentication failed',
        variant: 'destructive',
      });
      return false;
    } finally {
      setTesting(false);
    }
  };

  const configureSecrets = async () => {
    setSaving(true);
    try {
      if (!credentials.username || !credentials.password || !credentials.apiUrl) {
        throw new Error('All fields are required');
      }

      // Test credentials first
      const isValid = await testCredentials();
      if (!isValid) {
        throw new Error('Invalid credentials - please check and try again');
      }

      // Hash password (MD5)
      const { GPS51Utils } = await import('@/services/gps51/GPS51Utils');
      const hashedPassword = await GPS51Utils.ensureMD5Hash(credentials.password);

      // Save to localStorage for immediate use
      localStorage.setItem('gps51_api_url', credentials.apiUrl);
      localStorage.setItem('gps51_username', credentials.username);
      localStorage.setItem('gps51_password_hash', hashedPassword);

      toast({
        title: 'Secrets Configured',
        description: 'GPS51 credentials have been saved locally. For production deployment, configure Supabase secrets.',
      });

      // Refresh secrets status
      await checkSecretsStatus();

    } catch (error) {
      toast({
        title: 'Configuration Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    checkSecretsStatus();
    
    // Load existing credentials from localStorage
    const savedApiUrl = localStorage.getItem('gps51_api_url');
    const savedUsername = localStorage.getItem('gps51_username');
    
    if (savedApiUrl || savedUsername) {
      setCredentials(prev => ({
        ...prev,
        apiUrl: savedApiUrl || prev.apiUrl,
        username: savedUsername || ''
      }));
    }
  }, []);

  const allSecretsConfigured = secretsStatus && 
    Object.values(secretsStatus).every(status => status === true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          GPS51 Secrets Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Secrets Status */}
        <div className="space-y-3">
          <h4 className="font-medium">Current Secrets Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {secretsStatus && Object.entries(secretsStatus).map(([key, status]) => (
              <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm font-mono">{key}</span>
                {status ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Missing
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {!allSecretsConfigured && (
          <>
            <Alert>
              <AlertDescription>
                Configure GPS51 credentials below. These will be saved locally for immediate use.
                For production deployment, configure these as Supabase secrets.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <Label htmlFor="apiUrl">GPS51 API URL</Label>
                <Input
                  id="apiUrl"
                  value={credentials.apiUrl}
                  onChange={(e) => setCredentials(prev => ({ ...prev, apiUrl: e.target.value }))}
                  placeholder="https://api.gps51.com/openapi"
                />
              </div>

              <div>
                <Label htmlFor="username">GPS51 Username</Label>
                <Input
                  id="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your GPS51 username"
                />
              </div>

              <div>
                <Label htmlFor="password">GPS51 Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter your GPS51 password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={testCredentials}
                  disabled={testing || !credentials.username || !credentials.password}
                  variant="outline"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Test Credentials
                </Button>

                <Button 
                  onClick={configureSecrets}
                  disabled={saving || !credentials.username || !credentials.password}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Configuration
                </Button>
              </div>
            </div>
          </>
        )}

        {allSecretsConfigured && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All GPS51 secrets are properly configured. The system is ready for GPS51 operations.
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-4 border-t">
          <Button 
            onClick={checkSecretsStatus}
            variant="outline"
            size="sm"
          >
            <Key className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};