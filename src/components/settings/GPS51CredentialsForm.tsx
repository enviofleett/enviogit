
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, TestTube, Trash2, CheckCircle, AlertCircle, Bug, Loader2 } from 'lucide-react';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';
import { md5 } from 'js-md5';

export const GPS51CredentialsForm = () => {
  const [formData, setFormData] = useState({
    apiUrl: 'https://api.gps51.com/openapi',
    username: '',
    password: '',
    apiKey: '',
    from: 'WEB' as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN',
    type: 'USER' as 'USER' | 'DEVICE'
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  const { toast } = useToast();
  const { status, connect, disconnect, refresh } = useGPS51SessionBridge();

  // Load saved configuration on component mount
  useEffect(() => {
    const loadConfiguration = () => {
      const savedConfig = {
        apiUrl: localStorage.getItem('gps51_api_url') || 'https://api.gps51.com/openapi',
        username: localStorage.getItem('gps51_username') || '',
        from: (localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
        type: (localStorage.getItem('gps51_type') as 'USER' | 'DEVICE') || 'USER',
        apiKey: localStorage.getItem('gps51_api_key') || ''
      };
      
      setFormData(prev => ({
        ...prev,
        ...savedConfig
      }));
    };

    loadConfiguration();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isValidMD5 = (str: string): boolean => {
    return /^[a-f0-9]{32}$/.test(str);
  };

  const validateForm = () => {
    if (!formData.apiUrl || !formData.username || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in API URL, username, and password.",
        variant: "destructive",
      });
      return false;
    }

    try {
      new URL(formData.apiUrl);
    } catch {
      toast({
        title: "Invalid API URL",
        description: "Please enter a valid API URL.",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.apiUrl.includes('api.gps51.com')) {
      toast({
        title: "Incorrect API URL",
        description: "GPS51 API URL should use 'api.gps51.com' subdomain, not 'www.gps51.com'",
        variant: "destructive",
      });
      return false;
    }

    if (formData.apiUrl.includes('/webapi')) {
      toast({
        title: "Deprecated API Endpoint",
        description: "Please update your API URL to use the new '/openapi' endpoint instead of '/webapi'",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const prepareCredentials = (rawPassword: string) => {
    const hashedPassword = isValidMD5(rawPassword) ? rawPassword : md5(rawPassword).toLowerCase();
    
    const credentials = {
      apiUrl: formData.apiUrl,
      username: formData.username,
      password: hashedPassword,
      apiKey: formData.apiKey,
      from: formData.from,
      type: formData.type
    };

    setDebugInfo({
      originalPassword: {
        length: rawPassword.length,
        isAlreadyHashed: isValidMD5(rawPassword),
        firstChars: rawPassword.substring(0, 4) + '...'
      },
      processedPassword: {
        length: hashedPassword.length,
        isValidMD5: isValidMD5(hashedPassword),
        firstChars: hashedPassword.substring(0, 8) + '...'
      },
      credentials: {
        ...credentials,
        password: hashedPassword.substring(0, 8) + '...'
      },
      timestamp: new Date().toISOString()
    });

    return credentials;
  };

  const saveCredentialsToStorage = (credentials: any) => {
    try {
      localStorage.setItem('gps51_api_url', credentials.apiUrl);
      localStorage.setItem('gps51_username', credentials.username);
      localStorage.setItem('gps51_password_hash', credentials.password);
      localStorage.setItem('gps51_from', credentials.from);
      localStorage.setItem('gps51_type', credentials.type);
      
      if (credentials.apiKey) {
        localStorage.setItem('gps51_api_key', credentials.apiKey);
      }

      const safeCredentials = {
        username: credentials.username,
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type,
        hasApiKey: !!credentials.apiKey
      };
      localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));
      
      console.log('GPS51 credentials saved to localStorage');
    } catch (error) {
      console.error('Failed to save credentials to localStorage:', error);
      throw new Error('Failed to save credentials');
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      console.log('=== GPS51 SAVE CREDENTIALS DEBUG ===');
      
      const credentials = prepareCredentials(formData.password);
      console.log('Credentials prepared for save');

      saveCredentialsToStorage(credentials);
      console.log('Credentials saved to localStorage');

      console.log('Testing authentication...');
      const success = await connect(credentials);
      
      if (success) {
        console.log('Authentication successful');
        toast({
          title: "Settings Saved",
          description: "GPS51 credentials have been saved and authenticated successfully.",
        });
        
        setFormData(prev => ({ ...prev, password: '' }));
        
        try {
          console.log('Testing immediate sync...');
          const syncResult = await refresh();
          console.log('Sync test successful:', syncResult);
          
          if (syncResult && syncResult.vehiclesSynced !== undefined) {
            toast({
              title: "Sync Test Successful",
              description: `Found ${syncResult.devicesFound || 0} devices, synced ${syncResult.vehiclesSynced} vehicles and ${syncResult.positionsStored || 0} positions.`,
            });
          }
        } catch (syncError) {
          console.warn('Sync test failed but authentication worked:', syncError);
          toast({
            title: "Authentication Successful",
            description: "Credentials saved successfully, but sync test encountered issues. Live data may need manual refresh.",
            variant: "default",
          });
        }
      } else {
        console.error('Authentication failed:', status.error);
        toast({
          title: "Authentication Failed",
          description: status.error || "Failed to authenticate with GPS51 after saving credentials.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Save credentials error:', error);
      toast({
        title: "Save Failed",
        description: `Failed to save credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setIsTesting(true);
    try {
      console.log('=== GPS51 TEST CONNECTION DEBUG ===');
      const credentials = prepareCredentials(formData.password);
      
      console.log('Testing connection with credentials');
      
      const success = await connect(credentials);
      
      if (success) {
        toast({
          title: "Connection Successful",
          description: "Successfully connected to GPS51 API.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: status.error || "Failed to connect to GPS51 API.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : 'Connection failed',
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncData = async () => {
    if (!status.isAuthenticated) {
      toast({
        title: "Not Authenticated",
        description: "Please save and connect first before syncing data.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Manual sync requested...');
      const result = await refresh();
      
      if (result && result.success) {
        toast({
          title: "Sync Successful",
          description: `Synced ${result.vehiclesSynced || 0} vehicles and ${result.positionsStored || 0} positions.`,
        });
      } else {
        throw new Error(result?.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync data error:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : 'Data sync failed',
        variant: "destructive",
      });
    }
  };

  const handleClearConfiguration = () => {
    disconnect();
    setFormData({
      apiUrl: 'https://api.gps51.com/openapi',
      username: '',
      password: '',
      apiKey: '',
      from: 'WEB',
      type: 'USER'
    });
    setDebugInfo(null);
    
    toast({
      title: "Configuration Cleared",
      description: "GPS51 configuration has been removed.",
    });
  };

  const getConnectionStatusIcon = () => {
    if (status.isAuthenticated && status.connectionHealth === 'good') {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (status.error) {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          GPS51 API Configuration
          {getConnectionStatusIcon()}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="ml-auto"
          >
            <Bug className="h-4 w-4" />
            Debug
          </Button>
        </CardTitle>
        <CardDescription>
          Configure your GPS51 API credentials to enable real-time fleet tracking and data synchronization.
          {status.isConfigured && (
            <span className="block mt-2 text-green-600 text-sm">
              ✅ Configuration saved and ready to use
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiUrl">API URL *</Label>
          <Input
            id="apiUrl"
            type="url"
            placeholder="https://api.gps51.com/openapi"
            value={formData.apiUrl}
            onChange={(e) => handleInputChange('apiUrl', e.target.value)}
          />
          <p className="text-xs text-gray-500">
            ⚠️ Must use <strong>api.gps51.com/openapi</strong> endpoint (NEW endpoint - /webapi is deprecated)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="from">Platform *</Label>
            <Select value={formData.from} onValueChange={(value: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') => handleInputChange('from', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEB">WEB</SelectItem>
                <SelectItem value="ANDROID">ANDROID</SelectItem>
                <SelectItem value="IPHONE">IPHONE</SelectItem>
                <SelectItem value="WEIXIN">WEIXIN</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Login Type *</Label>
            <Select value={formData.type} onValueChange={(value: 'USER' | 'DEVICE') => handleInputChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">USER</SelectItem>
                <SelectItem value="DEVICE">DEVICE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            type="text"
            placeholder="Your GPS51 username"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Your GPS51 password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Will be automatically encrypted using MD5 if not already hashed
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key (Optional)</Label>
          <Input
            id="apiKey"
            type="text"
            placeholder="Your GPS51 API key (if required)"
            value={formData.apiKey}
            onChange={(e) => handleInputChange('apiKey', e.target.value)}
          />
        </div>

        {showDebug && debugInfo && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">🐛 Debug Information</h4>
            <pre className="text-xs text-gray-600 overflow-auto max-h-40">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Critical Configuration Requirements</h4>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• API URL must use <strong>api.gps51.com/openapi</strong> (NEW endpoint - /webapi is deprecated)</li>
            <li>• Platform and Login Type values are case-sensitive</li>
            <li>• Password will be MD5 encrypted automatically if needed</li>
            <li>• Authentication uses POST method with JSON body</li>
          </ul>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave}
            disabled={isLoading || isTesting}
            className="flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isLoading ? 'Saving...' : 'Save & Connect'}
          </Button>
          
          <Button 
            onClick={handleTestConnection}
            disabled={isTesting || isLoading || !formData.apiUrl || !formData.username || !formData.password}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>

          {status.isAuthenticated && (
            <Button 
              onClick={handleSyncData}
              disabled={status.syncStatus === 'syncing'}
              variant="secondary"
              className="flex items-center gap-2"
            >
              {status.syncStatus === 'syncing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {status.syncStatus === 'syncing' ? 'Syncing...' : 'Sync Data'}
            </Button>
          )}

          {status.isConfigured && (
            <Button 
              onClick={handleClearConfiguration}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {status.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              ❌ Connection failed: {status.error}
            </p>
            {showDebug && (
              <details className="mt-2">
                <summary className="text-xs text-red-600 cursor-pointer">Show technical details</summary>
                <div className="mt-1 text-xs text-red-600">
                  Last attempt: {new Date().toLocaleString()}<br/>
                  Status: {status.syncStatus}<br/>
                  Health: {status.connectionHealth}
                </div>
              </details>
            )}
          </div>
        )}

        {status.isAuthenticated && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✅ Connected to GPS51 API
              <span className="block text-xs mt-1">
                Connection Health: {status.connectionHealth.toUpperCase()}
              </span>
              <span className="block text-xs mt-1">
                Sync Status: {status.syncStatus.toUpperCase()}
              </span>
              {status.lastSync && (
                <span className="block text-xs mt-1">
                  Last sync: {status.lastSync.toLocaleString()}
                </span>
              )}
            </p>
          </div>
        )}

        {status.syncStatus === 'syncing' && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              🔄 Syncing data from GPS51...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
