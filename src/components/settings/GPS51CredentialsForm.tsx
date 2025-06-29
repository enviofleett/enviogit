
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import { CredentialsFormFields } from './GPS51CredentialsForm/CredentialsFormFields';
import { CredentialsFormActions } from './GPS51CredentialsForm/CredentialsFormActions';
import { StatusDisplay } from './GPS51CredentialsForm/StatusDisplay';
import { useCredentialsForm } from './GPS51CredentialsForm/useCredentialsForm';

export const GPS51CredentialsForm = () => {
  const {
    formData,
    showPassword,
    setShowPassword,
    isLoading,
    setIsLoading,
    isTesting,
    setIsTesting,
    showDebug,
    setShowDebug,
    debugInfo,
    status,
    connect,
    disconnect,
    refresh,
    toast,
    handleInputChange,
    validateForm,
    prepareCredentials,
  } = useCredentialsForm();

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
      saveCredentialsToStorage(credentials);

      const success = await connect(credentials);
      
      if (success) {
        toast({
          title: "Settings Saved",
          description: "GPS51 credentials have been saved and authenticated successfully.",
        });
        
        // Clear password field for security
        handleInputChange('password', '');
        
        // Test immediate sync
        try {
          await refresh();
        } catch (syncError) {
          console.warn('Sync test failed but authentication worked:', syncError);
        }
      } else {
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
      const credentials = prepareCredentials(formData.password);
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
    handleInputChange('apiUrl', 'https://api.gps51.com/openapi');
    handleInputChange('username', '');
    handleInputChange('password', '');
    handleInputChange('apiKey', '');
    handleInputChange('from', 'WEB');
    handleInputChange('type', 'USER');
    
    toast({
      title: "Configuration Cleared",
      description: "GPS51 configuration has been removed.",
    });
  };

  const canTest = formData.apiUrl && formData.username && formData.password;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          GPS51 API Configuration
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
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CredentialsFormFields 
          formData={formData}
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onInputChange={handleInputChange}
        />

        {/* Debug Information Panel */}
        {showDebug && debugInfo && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">🐛 Debug Information</h4>
            <pre className="text-xs text-gray-600 overflow-auto max-h-40">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        {/* Critical Configuration Notes */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Critical Configuration Requirements</h4>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• API URL must use <strong>api.gps51.com/openapi</strong> (NEW endpoint - /webapi is deprecated)</li>
            <li>• Platform and Login Type values are case-sensitive</li>
            <li>• Password will be MD5 encrypted automatically if needed</li>
            <li>• Authentication uses POST method with JSON body</li>
          </ul>
        </div>

        <CredentialsFormActions
          isLoading={isLoading}
          isTesting={isTesting}
          canTest={canTest}
          status={status}
          onSave={handleSave}
          onTestConnection={handleTestConnection}
          onSyncData={handleSyncData}
          onClearConfiguration={handleClearConfiguration}
        />

        <StatusDisplay status={status} showDebug={showDebug} />
      </CardContent>
    </Card>
  );
};
