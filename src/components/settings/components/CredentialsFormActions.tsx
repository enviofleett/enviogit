
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, TestTube, Trash2 } from 'lucide-react';

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
  formData: {
    apiUrl: string;
    username: string;
    password: string;
  };
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
  return (
    <div className="flex gap-2 pt-4">
      <Button 
        onClick={onSave}
        disabled={isLoading || isTesting}
        className="flex items-center gap-2"
      >
        <Save className="h-4 w-4" />
        {isLoading ? 'Saving...' : 'Save & Connect'}
      </Button>
      
      <Button 
        onClick={onTestConnection}
        disabled={isTesting || isLoading || !formData.apiUrl || !formData.username || !formData.password}
        variant="outline"
        className="flex items-center gap-2"
      >
        <TestTube className="h-4 w-4" />
        {isTesting ? 'Testing...' : 'Test Connection'}
      </Button>

      {isAuthenticated && (
        <Button 
          onClick={onSyncData}
          disabled={syncStatus === 'syncing'}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Data'}
        </Button>
      )}

      {isConfigured && (
        <Button 
          onClick={onClearConfiguration}
          variant="destructive"
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
};
