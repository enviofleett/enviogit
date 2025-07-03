
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle, Bug } from 'lucide-react';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';
import { md5 } from 'js-md5';
import { CredentialsFormFields } from './components/CredentialsFormFields';
import { CredentialsFormActions } from './components/CredentialsFormActions';
import { CredentialsFormStatus } from './components/CredentialsFormStatus';
import { CredentialsFormDebug } from './components/CredentialsFormDebug';
import { CredentialsFormNotes } from './components/CredentialsFormNotes';

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

    // Basic URL validation
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

    // Validate correct API URL - updated for openapi endpoint
    if (!formData.apiUrl.includes('api.gps51.com')) {
      toast({
        title: "Incorrect API URL",
        description: "GPS51 API URL should use 'api.gps51.com' subdomain, not 'www.gps51.com'",
        variant: "destructive",
      });
      return false;
    }

    // Check for deprecated webapi endpoint
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

  const prepareCredentials = async (rawPassword: string) => {
    if (!rawPassword) {
      throw new Error('Password is required');
    }

    // Use GPS51Utils for consistent async MD5 hashing
    const { GPS51Utils } = await import('@/services/gps51/GPS51Utils');
    
    let hashedPassword: string;
    try {
      hashedPassword = await GPS51Utils.ensureMD5Hash(rawPassword);
      console.log('GPS51CredentialsForm: Password processed through GPS51Utils:', {
        originalLength: rawPassword.length,
        hashedLength: hashedPassword.length,
        isValidMD5: GPS51Utils.validateMD5Hash(hashedPassword)
      });
    } catch (error) {
      console.error('GPS51CredentialsForm: Password hashing failed:', error);
      throw new Error(`Password processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    const credentials = {
      apiUrl: formData.apiUrl,
      username: formData.username,
      password: hashedPassword,
      apiKey: formData.apiKey,
      from: formData.from,
      type: formData.type
    };

    // Store debug info
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
        password: hashedPassword.substring(0, 8) + '...' // Truncated for security
      },
      timestamp: new Date().toISOString()
    });

    return credentials;
  };

  const saveCredentialsToStorage = (credentials: any) => {
    try {
      // Save individual items for easy access
      localStorage.setItem('gps51_api_url', credentials.apiUrl);
      localStorage.setItem('gps51_username', credentials.username);
      localStorage.setItem('gps51_password_hash', credentials.password);
      localStorage.setItem('gps51_from', credentials.from);
      localStorage.setItem('gps51_type', credentials.type);
      
      if (credentials.apiKey) {
        localStorage.setItem('gps51_api_key', credentials.apiKey);
      }

      // Save as JSON for session bridge
      const safeCredentials = {
        username: credentials.username,
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type,
        hasApiKey: !!credentials.apiKey
      };
      localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));
      
      console.log('GPS51 credentials saved to localStorage:', {
        keys: Object.keys(localStorage).filter(k => k.startsWith('gps51_')),
        credentialsKeys: Object.keys(safeCredentials)
      });
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
      console.log('1. Form validation passed');
      
      const credentials = await prepareCredentials(formData.password);
      console.log('2. Credentials prepared:', {
        username: credentials.username,
        apiUrl: credentials.apiUrl,
        passwordIsHashed: isValidMD5(credentials.password),
        from: credentials.from,
        type: credentials.type,
        hasApiKey: !!credentials.apiKey
      });

      // Save to localStorage first
      saveCredentialsToStorage(credentials);
      console.log('3. Credentials saved to localStorage');

      // Test authentication
      console.log('4. Testing authentication...');
      const success = await connect(credentials);
      
      if (success) {
        console.log('5. Authentication successful');
        toast({
          title: "Settings Saved",
          description: "GPS51 credentials have been saved and authenticated successfully.",
        });
        
        // Clear password field for security
        setFormData(prev => ({ ...prev, password: '' }));
        
        // Test immediate sync to verify everything works
        try {
          console.log('6. Testing immediate sync...');
          await refresh();
          console.log('7. Sync test successful');
        } catch (syncError) {
          console.warn('Sync test failed but authentication worked:', syncError);
        }
      } else {
        console.error('5. Authentication failed:', status.error);
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
      const credentials = await prepareCredentials(formData.password);
      
      console.log('Testing connection with credentials:', {
        username: credentials.username,
        apiUrl: credentials.apiUrl,
        passwordIsHashed: isValidMD5(credentials.password),
        from: credentials.from,
        type: credentials.type
      });
      
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
      
      toast({
        title: "Sync Successful",
        description: `Synced ${result.vehiclesSynced} vehicles and ${result.positionsStored} positions.`,
      });
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
        <CredentialsFormFields
          formData={formData}
          showPassword={showPassword}
          onInputChange={handleInputChange}
          onTogglePassword={() => setShowPassword(!showPassword)}
        />

        <CredentialsFormDebug
          showDebug={showDebug}
          debugInfo={debugInfo}
        />

        <CredentialsFormNotes />

        <CredentialsFormActions
          onSave={handleSave}
          onTestConnection={handleTestConnection}
          onSyncData={handleSyncData}
          onClearConfiguration={handleClearConfiguration}
          isLoading={isLoading}
          isTesting={isTesting}
          isAuthenticated={status.isAuthenticated}
          isConfigured={status.isConfigured}
          syncStatus={status.syncStatus}
          formData={formData}
        />

        <CredentialsFormStatus
          status={status}
          showDebug={showDebug}
        />
      </CardContent>
    </Card>
  );
};
