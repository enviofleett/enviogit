
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Loader2 } from 'lucide-react';
import { useGPS51Data } from '@/hooks/useGPS51Data';
import { useToast } from '@/hooks/use-toast';

const GPS51SyncButton: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const { triggerSync } = useGPS51Data();
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await triggerSync();
      toast({
        title: 'GPS51 Sync Completed',
        description: `Synced ${result.vehiclesSynced} vehicles and ${result.positionsStored} positions`,
      });
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button 
      onClick={handleSync}
      disabled={syncing}
      className="flex items-center space-x-2"
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Zap className="h-4 w-4" />
      )}
      <span>{syncing ? 'Syncing...' : 'Sync GPS51'}</span>
    </Button>
  );
};

export default GPS51SyncButton;
