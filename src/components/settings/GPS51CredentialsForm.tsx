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
      apiKey: formData.apiKey,
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

  const saveCredentialsToStorage = (credentials: any) => {
    try {
      console.log('=== SAVING CREDENTIALS TO STORAGE ===');
      
      // Validate credentials before saving
      const validation = CredentialsValidator.validateCredentials(credentials);
      if (!validation.isValid) {
        throw new Error(`Invalid credentials: ${validation.errors.join(', ')}`);
      }

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
        hasApiKey: !!credentials.apiKey,
        hasPassword: !!credentials.password,
        passwordIsHashed: CredentialsValidator.isValidMD5(credentials.password)
      };
      localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));
      
      console.log('GPS51 credentials saved successfully:', {
        keys: Object.keys(localStorage).filter(k => k.startsWith('gps51_')),
        credentialsKeys: Object.keys(safeCredentials),
        hasPassword: safeCredentials.hasPassword,
        passwordIsHashed: safeCredentials.passwordIsHashed
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
      console.log('=== GPS51 SAVE CREDENTIALS FLOW ===');
      console.log('1. Form validation passed');
      
      const credentials = prepareCredentials(formData.password);
      console.log('2. Credentials prepared with hashed password');

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
      console.log('=== GPS51 TEST CONNECTION FLOW ===');
      const credentials = prepareCredentials(formData.password);
      
      console.log('Testing connection with credentials:', {
        username: credentials.username,
        apiUrl: credentials.apiUrl,
        passwordIsHashed: CredentialsValidator.isValidMD5(credentials.password),
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
    setValidationResult(null);
    
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
