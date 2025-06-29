
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCredentialsForm } from './GPS51CredentialsForm/useCredentialsForm';
import { CredentialsFormFields } from './GPS51CredentialsForm/CredentialsFormFields';
import { CredentialsFormActions } from './GPS51CredentialsForm/CredentialsFormActions';
import { StatusDisplay } from './GPS51CredentialsForm/StatusDisplay';

export const GPS51CredentialsForm: React.FC = () => {
  const {
    formData,
    showPassword,
    setShowPassword,
    isLoading,
    isTesting,
    showDebug,
    debugInfo,
    status,
    refresh,
    handleInputChange,
    handleSave,
    handleTestConnection,
    handleClearConfiguration
  } = useCredentialsForm();

  const canTest = !!(
    formData.apiUrl &&
    formData.username &&
    formData.password
  );

  const handleSyncData = async () => {
    try {
      await refresh();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>GPS51 Integration Configuration</CardTitle>
          <CardDescription>
            Configure your GPS51 API credentials to enable real-time vehicle tracking and data synchronization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <StatusDisplay status={status} showDebug={showDebug} />
          
          <CredentialsFormFields
            formData={formData}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            onInputChange={handleInputChange}
            disabled={isLoading || isTesting}
          />
          
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
          
          {debugInfo && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-sm mb-2">Debug Information</h3>
              <pre className="text-xs text-gray-600 overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
