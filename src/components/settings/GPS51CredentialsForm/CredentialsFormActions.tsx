
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, TestTube, Trash2 } from 'lucide-react';
import type { SessionStatus } from '@/hooks/useGPS51SessionBridge';

interface CredentialsFormActionsProps {
  isLoading: boolean;
  isTesting: boolean;
  canTest: boolean;
  status: SessionStatus;
  onSave: () => void;
  onTestConnection: () => void;
  onSyncData: () => void;
  onClearConfiguration: () => void;
}

export const CredentialsFormActions: React.FC<CredentialsFormActionsProps> = ({
  isLoading,
  isTesting,
  canTest,
  status,
  onSave,
  onTestConnection,
  onSyncData,
  onClearConfiguration
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
        disabled={isTesting || isLoading || !canTest}
        variant="outline"
        className="flex items-center gap-2"
      >
        <TestTube className="h-4 w-4" />
        {isTesting ? 'Testing...' : 'Test Connection'}
      </Button>

      {status.isAuthenticated && (
        <Button 
          onClick={onSyncData}
          disabled={status.syncStatus === 'syncing'}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {status.syncStatus === 'syncing' ? 'Syncing...' : 'Sync Data'}
        </Button>
      )}

      {status.isConfigured && (
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
