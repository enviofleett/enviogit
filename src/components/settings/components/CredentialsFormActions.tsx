
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, TestTube, RefreshCw, Trash2, Loader2 } from 'lucide-react';

interface FormData {
  apiUrl: string;
  username: string;
  password: string;
  from: string;
  type: string;
}

interface CredentialsFormActionsProps {
  onSave: () => void;
  onTestConnection: () => void;
  onSyncData: () => void;
  onClearConfiguration: () => void;
  isLoading: boolean;
  isTesting: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  syncStatus: string;
  formData: FormData;
}

export const CredentialsFormActions: React.FC<CredentialsFormActionsProps> = ({
  onSave,
  onTestConnection,
  onSyncData,
  onClearConfiguration,
  isLoading,
  isTesting,
  isAuthenticated,
  isConfigured,
  syncStatus,
  formData
}) => {
  const canSave = formData.apiUrl && formData.username && formData.password;
  const canTest = canSave && !isLoading;
  const canSync = isConfigured && !isLoading && syncStatus !== 'syncing';

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={onSave}
        disabled={!canSave || isLoading}
        className="flex items-center gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {isLoading ? 'Saving...' : 'Save Configuration'}
      </Button>

      <Button
        onClick={onTestConnection}
        disabled={!canTest || isTesting}
        variant="outline"
        className="flex items-center gap-2"
      >
        {isTesting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <TestTube className="h-4 w-4" />
        )}
        {isTesting ? 'Testing...' : 'Test Connection'}
      </Button>

      {isConfigured && (
        <>
          <Button
            onClick={onSyncData}
            disabled={!canSync}
            variant="outline"
            className="flex items-center gap-2"
          >
            {syncStatus === 'syncing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Data'}
          </Button>

          <Button
            onClick={onClearConfiguration}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Configuration
          </Button>
        </>
      )}
    </div>
  );
};
