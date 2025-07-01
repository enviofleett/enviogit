
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertCircle, Bug } from 'lucide-react';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';
import { CredentialsFormFields } from './components/CredentialsFormFields';
import { CredentialsFormActions } from './components/CredentialsFormActions';
import { CredentialsFormStatus } from './components/CredentialsFormStatus';
import { CredentialsFormDebug } from './components/CredentialsFormDebug';
import { CredentialsFormNotes } from './components/CredentialsFormNotes';
import { CredentialsValidator } from './components/CredentialsValidator';
import { gps51ConfigManager } from '@/services/gps51/GPS51ConfigurationManager';

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
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const { toast } = useToast();
  const { status, connect, disconnect, refresh } = useGPS51SessionBridge();

  // Load saved configuration on component mount
  useEffect(() => {
    const loadConfiguration = () => {
      console.log('Loading GPS51 configuration...');
      
      const configStatus = gps51ConfigManager.getConfigurationStatus();
      
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

      // Validate stored credentials on load
      const storedValidation = CredentialsValidator.validateStoredCredentials();
      setValidationResult(storedValidation);
      
      console.log('Configuration loaded:', {
        isConfigured: configStatus.isConfigured,
        hasCredentials: Object.keys(savedConfig).filter(k => savedConfig[k as keyof typeof savedConfig]).length
      });
    };

    loadConfiguration();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Real-time validation
    const updatedFormData = { ...formData, [field]: value };
    const validation = CredentialsValidator.validateCredentials(updatedFormData);
    setValidationResult(validation);
  };

  const validateForm = () => {
    const validation = CredentialsValidator.validateCredentials(formData);
    setValidationResult(validation);

    if (!validation.isValid) {
      toast({
        title: "Validation Failed",
        description: validation.errors.join(', '),
        variant: "destructive",
      });
      return false;
    }

    if (validation.warnings.length > 0) {
      toast({
        title: "Validation Warnings",
        description: validation.warnings.join(', '),
        variant: "default",
      });
    }

    return true;
  };

  const prepareCredentials = (rawPassword: string) => {
    console.log('=== PREPARING GPS51 CREDENTIALS ===');
    
    // Hash password using validator
    const hashedPassword = CredentialsValidator.hashPassword(rawPassword);
    
    console.log('Password processing:', {
      originalLength: rawPassword.length,
      isAlreadyHashed: CredentialsValidator.isValidMD5(rawPassword),
      finalHashLength: hashedPassword.length,
      finalHashIsValid: CredentialsValidator.isValidMD5(hashedPassword)
    });

    const credentials = {
      apiUrl: formData.apiUrl,
      username: formData.username,
      password: hashedPassword,
      from: formData.from,
      type: formData.type
    };

    // Store debug info
    setDebugInfo({
      validation: validationResult,
      originalPassword: {
        length: rawPassword.length,
        isAlreadyHashed: CredentialsValidator.isValidMD5(rawPassword),
        firstChars: rawPassword.substring(0, 4) + '...'
      },
      processedPassword: {
        length: hashedPassword.length,
        isValidMD5: CredentialsValidator.isValidMD5(hashedPassword),
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

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      console.log('=== GPS51 SAVE CREDENTIALS FLOW ===');
      console.log('1. Form validation passed');
      
      const credentials = prepareCredentials(formData.password);
      console.log('2. Credentials prepared with hashed password');

      // Use the configuration manager to save and test
      await gps51ConfigManager.configure({
        apiUrl: credentials.apiUrl,
        username: credentials.username,
        password: credentials.password,
        loginFrom: credentials.from,
        loginType: credentials.type
      });
      
      console.log('3. Configuration manager setup successful');

      // Test the connection
      const testResult = await gps51ConfigManager.testConnection();
      
      if (testResult.success) {
        console.log('4. Connection test successful');
        toast({
          title: "Settings Saved",
          description: `GPS51 credentials saved and verified. Found ${testResult.deviceCount || 0} devices.`,
        });
        
        // Clear password field for security
        setFormData(prev => ({ ...prev, password: '' }));
        
        // Update session bridge status
        await connect(credentials);
      } else {
        console.error('4. Connection test failed:', testResult.error);
        toast({
          title: "Configuration Saved But Connection Failed",
          description: testResult.error || "Credentials saved but unable to connect to GPS51.",
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
      console.log('=== GPS51 TEST CONNECTION FLOW ===');
      const credentials = prepareCredentials(formData.password);
      
      console.log('Testing connection with credentials...');
      
      // Test connection using configuration manager
      await gps51ConfigManager.configure({
        apiUrl: credentials.apiUrl,
        username: credentials.username,
        password: credentials.password,
        loginFrom: credentials.from,
        loginType: credentials.type
      });
      
      const testResult = await gps51ConfigManager.testConnection();
      
      if (testResult.success) {
        toast({
          title: "Connection Successful",
          description: `Successfully connected to GPS51 API. Found ${testResult.deviceCount || 0} devices.`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: testResult.error || "Failed to connect to GPS51 API.",
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
    if (!gps51ConfigManager.isConfigured()) {
      toast({
        title: "Not Configured",
        description: "Please save and test connection first before syncing data.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Manual sync requested...');
      const result = await gps51ConfigManager.testConnection();
      
      if (result.success) {
        toast({
          title: "Sync Successful",
          description: `Found ${result.deviceCount || 0} devices from GPS51.`,
        });
      } else {
        throw new Error(result.error || 'Sync failed');
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
    gps51ConfigManager.clearConfiguration();
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
    setValidationResult(null);
    
    toast({
      title: "Configuration Cleared",
      description: "GPS51 configuration has been removed.",
    });
  };

  const getConnectionStatusIcon = () => {
    const configStatus = gps51ConfigManager.getConfigurationStatus();
    
    if (configStatus.isConfigured && status.isAuthenticated) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (status.error) {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
    return null;
  };

  const configStatus = gps51ConfigManager.getConfigurationStatus();

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
          {configStatus.isConfigured && (
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

        {validationResult && (
          <div className="space-y-2">
            {validationResult.errors?.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800">Validation Errors:</p>
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {validationResult.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validationResult.warnings?.length > 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm font-medium text-yellow-800">Warnings:</p>
                <ul className="text-sm text-yellow-700 list-disc list-inside">
                  {validationResult.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
          isAuthenticated={configStatus.isConfigured}
          isConfigured={configStatus.isConfigured}
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
