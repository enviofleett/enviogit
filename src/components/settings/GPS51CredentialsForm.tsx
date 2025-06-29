
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';

// Import our new modular components
import { GPS51FormFields } from './gps51/GPS51FormFields';
import { GPS51ActionButtons } from './gps51/GPS51ActionButtons';
import { GPS51StatusDisplay } from './gps51/GPS51StatusDisplay';
import { GPS51FormData, useGPS51FormValidation } from './gps51/GPS51FormValidation';
import { prepareCredentials, saveCredentialsToStorage, GPS51DebugInfo } from './gps51/GPS51CredentialUtils';

export const GPS51CredentialsForm = () => {
  const [formData, setFormData] = useState<GPS51FormData>({
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
  const [debugInfo, setDebugInfo] = useState<GPS51DebugInfo | null>(null);
  
  const { toast } = useToast();
  const { status, connect, disconnect, refresh } = useGPS51SessionBridge();
  const { validateForm } = useGPS51FormValidation();

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

  const handleSave = async () => {
    if (!validateForm(formData)) return;

    setIsLoading(true);
    try {
      console.log('=== GPS51 SAVE CREDENTIALS DEBUG ===');
      
      const { credentials, debugInfo: newDebugInfo } = prepareCredentials(formData);
      setDebugInfo(newDebugInfo);
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
    if (!validateForm(formData)) return;

    setIsTesting(true);
    try {
      console.log('=== GPS51 TEST CONNECTION DEBUG ===');
      const { credentials, debugInfo: newDebugInfo } = prepareCredentials(formData);
      setDebugInfo(newDebugInfo);
      
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          GPS51 API Configuration
          <GPS51StatusDisplay status={status} showDebug={showDebug} />
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
        <GPS51FormFields
          formData={formData}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          handleInputChange={handleInputChange}
        />

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

        <GPS51ActionButtons
          status={status}
          isLoading={isLoading}
          isTesting={isTesting}
          formData={formData}
          onSave={handleSave}
          onTest={handleTestConnection}
          onSync={handleSyncData}
          onClear={handleClearConfiguration}
        />

        <GPS51StatusDisplay status={status} showDebug={showDebug} />
      </CardContent>
    </Card>
  );
};
