
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Bug } from 'lucide-react';
import { useGPS51CredentialsForm } from './hooks/useGPS51CredentialsForm';
import { CredentialsFormFields } from './CredentialsFormFields';
import { CredentialsFormActions } from './CredentialsFormActions';
import { CredentialsFormStatus } from './CredentialsFormStatus';
import { CredentialsFormDebug } from './CredentialsFormDebug';
import { CredentialsFormNotes } from './CredentialsFormNotes';
import { GPS51FormValidation } from './GPS51FormValidation';

export const GPS51CredentialsFormContainer = () => {
  const {
    formData,
    showPassword,
    isLoading,
    isTesting,
    showDebug,
    debugInfo,
    validationResult,
    configStatus,
    status,
    handleInputChange,
    setShowPassword,
    setShowDebug,
    handleSave,
    handleTestConnection,
    handleSyncData,
    handleClearConfiguration
  } = useGPS51CredentialsForm();

  const getConnectionStatusIcon = () => {
    if (configStatus.isConfigured && status.isAuthenticated) {
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

        <GPS51FormValidation validationResult={validationResult} />

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
