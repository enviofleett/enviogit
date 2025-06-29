
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, TestTube, Trash2, Loader2 } from 'lucide-react';
import { SessionStatus } from '@/hooks/useGPS51SessionBridge';

interface GPS51ActionButtonsProps {
  status: SessionStatus;
  isLoading: boolean;
  isTesting: boolean;
  formData: any;
  onSave: () => void;
  onTest: () => void;
  onSync: () => void;
  onClear: () => void;
}

export const GPS51ActionButtons: React.FC<GPS51ActionButtonsProps> = ({
  status,
  isLoading,
  isTesting,
  formData,
  onSave,
  onTest,
  onSync,
  onClear
}) => {
  return (
    <div className="flex gap-2 pt-4">
      <Button 
        onClick={onSave}
        disabled={isLoading || isTesting}
        className="flex items-center gap-2"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isLoading ? 'Saving...' : 'Save & Connect'}
      </Button>
      
      <Button 
        onClick={onTest}
        disabled={isTesting || isLoading || !formData.apiUrl || !formData.username || !formData.password}
        variant="outline"
        className="flex items-center gap-2"
      >
        {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
        {isTesting ? 'Testing...' : 'Test Connection'}
      </Button>

      {status.isAuthenticated && (
        <Button 
          onClick={onSync}
          disabled={status.syncStatus === 'syncing'}
          variant="secondary"
          className="flex items-center gap-2"
        >
          {status.syncStatus === 'syncing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {status.syncStatus === 'syncing' ? 'Syncing...' : 'Sync Data'}
        </Button>
      )}

      {status.isConfigured && (
        <Button 
          onClick={onClear}
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
