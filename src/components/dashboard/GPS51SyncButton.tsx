
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { gps51ConfigManager } from '@/services/gps51/GPS51ConfigurationManager';

const GPS51SyncButton: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    // Check if GPS51 is configured
    if (!gps51ConfigManager.isConfigured()) {
      toast({
        title: 'Configuration Required',
        description: 'Please configure GPS51 credentials in Settings before syncing.',
        variant: 'destructive',
      });
      return;
    }

    setSyncing(true);
    try {
      const result = await gps51ConfigManager.testConnection();
      
      if (result.success) {
        toast({
          title: 'GPS51 Sync Completed',
          description: `Found ${result.deviceCount || 0} devices`,
        });
      } else {
        throw new Error(result.error || 'Sync failed');
      }
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

  const isConfigured = gps51ConfigManager.isConfigured();

  return (
    <Button 
      onClick={handleSync}
      disabled={syncing || !isConfigured}
      className="flex items-center space-x-2"
      variant={!isConfigured ? "outline" : "default"}
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : !isConfigured ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <Zap className="h-4 w-4" />
      )}
      <span>
        {syncing ? 'Syncing...' : !isConfigured ? 'Configure GPS51' : 'Sync GPS51'}
      </span>
    </Button>
  );
};

export default GPS51SyncButton;
