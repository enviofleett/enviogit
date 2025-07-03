import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  TestTube, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  Wifi,
  Shield
} from 'lucide-react';
import { GPS51ConnectionService } from '@/services/gps51/GPS51ConnectionService';
import { gps51AuthService } from '@/services/gps51/GPS51AuthenticationService';

export const GPS51ConnectionTest = () => {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isTestingAuth, setIsTestingAuth] = useState(false);
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    apiUrl: 'https://api.gps51.com/openapi'
  });
  const [connectionResult, setConnectionResult] = useState<any>(null);
  const [authResult, setAuthResult] = useState<any>(null);
  const { toast } = useToast();

  const testConnection = async () => {
    if (!credentials.apiUrl) {
      toast({
        title: "Missing Information",
        description: "Please enter the API URL",
        variant: "destructive",
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionResult(null);
    
    try {
      const result = await gps51AuthService.testConnection(credentials.apiUrl);
      setConnectionResult(result);
      
      if (result.success) {
        toast({
          title: "Connection Test Successful",
          description: `GPS51 API is reachable (${result.responseTime}ms)`,
        });
      } else {
        toast({
          title: "Connection Test Failed",
          description: result.error || 'Unknown error',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionResult({
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        title: "Connection Test Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testAuthentication = async () => {
    if (!credentials.username || !credentials.password || !credentials.apiUrl) {
      toast({
        title: "Missing Information", 
        description: "Please enter username, password, and API URL",
        variant: "destructive",
      });
      return;
    }

    setIsTestingAuth(true);
    setAuthResult(null);
    
    try {
      const connectionService = new GPS51ConnectionService();
      const result = await connectionService.connect({
        username: credentials.username,
        password: credentials.password,
        apiUrl: credentials.apiUrl,
        from: 'WEB',
        type: 'USER'
      });
      
      setAuthResult(result);
      
      if (result.success) {
        toast({
          title: "Authentication Successful",
          description: "GPS51 credentials are valid and authentication succeeded",
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: result.error || 'Unknown authentication error',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Authentication test failed:', error);
      setAuthResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        title: "Authentication Test Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsTestingAuth(false);
    }
  };

  const StatusBadge = ({ success, label }: { success: boolean; label: string }) => (
    <Badge variant={success ? 'default' : 'destructive'} className="flex items-center gap-1">
      {success ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </Badge>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          GPS51 Connection Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="test-username">Username</Label>
            <Input
              id="test-username"
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Enter GPS51 username"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="test-password">Password</Label>
            <Input
              id="test-password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter GPS51 password"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-api-url">API URL</Label>
          <Input
            id="test-api-url"
            type="url"
            value={credentials.apiUrl}
            onChange={(e) => setCredentials(prev => ({ ...prev, apiUrl: e.target.value }))}
            placeholder="https://api.gps51.com/openapi"
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={testConnection}
            disabled={isTestingConnection}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Wifi className={`h-4 w-4 ${isTestingConnection ? 'animate-pulse' : ''}`} />
            {isTestingConnection ? 'Testing...' : 'Test Connection'}
          </Button>
          
          <Button 
            onClick={testAuthentication}
            disabled={isTestingAuth}
            className="flex items-center gap-2"
          >
            <Shield className={`h-4 w-4 ${isTestingAuth ? 'animate-spin' : ''}`} />
            {isTestingAuth ? 'Authenticating...' : 'Test Authentication'}
          </Button>
        </div>

        {connectionResult && (
          <Alert>
            <Wifi className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Connection Test:</span>
                  <StatusBadge 
                    success={connectionResult.success} 
                    label={connectionResult.success ? 'Success' : 'Failed'} 
                  />
                  {connectionResult.success && (
                    <Badge variant="outline">{connectionResult.responseTime}ms</Badge>
                  )}
                </div>
                {connectionResult.error && (
                  <div className="text-sm text-destructive">
                    Error: {connectionResult.error}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {authResult && (
          <Alert variant={authResult.success ? 'default' : 'destructive'}>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Authentication Test:</span>
                  <StatusBadge 
                    success={authResult.success} 
                    label={authResult.success ? 'Success' : 'Failed'} 
                  />
                </div>
                {authResult.error && (
                  <div className="text-sm">
                    <div className="font-medium mb-1">Error Details:</div>
                    <div className="whitespace-pre-wrap">{authResult.error}</div>
                  </div>
                )}
                {authResult.success && (
                  <div className="text-sm text-green-600">
                    ✅ GPS51 authentication successful! You can now proceed with the live data synchronization.
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Test Instructions:</div>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><strong>Connection Test:</strong> Verifies if the GPS51 API server is reachable</li>
                <li><strong>Authentication Test:</strong> Tests your credentials and connection method</li>
                <li>The system will automatically choose the best connection method (proxy or direct)</li>
                <li>Both tests help diagnose connectivity issues before using the main application</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};