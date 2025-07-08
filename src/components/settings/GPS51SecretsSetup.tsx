import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Key, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { GPS51ConfigStorage } from '@/services/gps51/configStorage';
import { gps51UnifiedService } from '@/services/gps51/unified/GPS51UnifiedService';

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

  // Load existing credentials on mount
  useEffect(() => {
    const config = GPS51ConfigStorage.getConfiguration();
    if (config) {
      setCredentials({
        apiUrl: config.apiUrl,
        username: config.username,
        password: config.password
      });
    }
  }, []);

  const checkSecretsStatus = async () => {
    try {
      console.log('🔐 Checking GPS51 configuration status...');
      
      const isConfigured = GPS51ConfigStorage.isConfigured();
      const config = GPS51ConfigStorage.getConfiguration();
      
      setSecretsStatus({
        GPS51_API_URL: !!config?.apiUrl,
        GPS51_USERNAME: !!config?.username,
        GPS51_PASSWORD_HASH: !!config?.password
      });

      if (isConfigured) {
        toast({
          title: "GPS51 Configuration Found",
          description: "Credentials are properly configured",
        });
      } else {
        toast({
          title: "GPS51 Configuration Missing",
          description: "Please enter your GPS51 credentials",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Failed to check GPS51 configuration:', error);
      toast({
        title: "Configuration Check Failed", 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  };

  const testCredentials = async () => {
    if (!credentials.username || !credentials.password || !credentials.apiUrl) {
      toast({
        title: "Missing Credentials",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    try {
      console.log('🧪 Testing GPS51 credentials...');
      
      // Use the unified service to test authentication
      const result = await gps51UnifiedService.authenticate(
        credentials.username,
        credentials.password
      );

      if (result.isAuthenticated) {
        toast({
          title: "Authentication Successful",
          description: `Connected to GPS51 as ${credentials.username}`,
        });
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('❌ GPS51 authentication test failed:', error);
      toast({
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : 'Connection test failed',
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const saveCredentials = async () => {
    if (!credentials.username || !credentials.password || !credentials.apiUrl) {
      toast({
        title: "Missing Credentials",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      console.log('💾 Saving GPS51 credentials...');

      // Save using unified configuration storage
      GPS51ConfigStorage.saveConfiguration({
        apiUrl: credentials.apiUrl,
        username: credentials.username,
        password: credentials.password,
        from: 'WEB',
        type: 'USER'
      });

      // Test the saved credentials
      const result = await gps51UnifiedService.authenticate(
        credentials.username,
        credentials.password
      );

      if (result.isAuthenticated) {
        toast({
          title: "Credentials Saved Successfully",
          description: "GPS51 configuration is now active",
        });
        
        // Refresh status
        await checkSecretsStatus();
      } else {
        throw new Error(result.error || 'Authentication failed after saving');
      }
    } catch (error) {
      console.error('❌ Failed to save GPS51 credentials:', error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Check status on mount
  useEffect(() => {
    checkSecretsStatus();
  }, []);

  const allSecretsConfigured = secretsStatus && 
    Object.values(secretsStatus).every(status => status === true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          GPS51 Unified Credentials Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration Status */}
        <div className="space-y-3">
          <h4 className="font-medium">Configuration Status</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {secretsStatus && Object.entries(secretsStatus).map(([key, status]) => (
              <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm font-mono">{key}</span>
                {status ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Set
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
                Configure GPS51 credentials to enable full system functionality.
                These will be stored using the unified configuration system.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">GPS51 API URL</Label>
                <Input
                  id="apiUrl"
                  type="url"
                  value={credentials.apiUrl}
                  onChange={(e) => setCredentials(prev => ({ ...prev, apiUrl: e.target.value }))}
                  placeholder="https://www.gps51.com:9015/RCSWebAPI/"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">GPS51 Username</Label>
                <Input
                  id="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your GPS51 username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">GPS51 Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter your GPS51 password"
                    required
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
                  disabled={testing || saving}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </div>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                
                <Button
                  onClick={saveCredentials}
                  disabled={testing || saving}
                  className="flex-1"
                >
                  {saving ? (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    'Save Credentials'
                  )}
                </Button>
                
                <Button
                  onClick={checkSecretsStatus}
                  variant="outline"
                  size="sm"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {allSecretsConfigured && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              ✅ GPS51 credentials are properly configured. The unified service is ready for operation.
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