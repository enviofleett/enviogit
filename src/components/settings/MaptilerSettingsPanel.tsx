import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Globe, Key, TestTube } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { maptilerService, MaptilerConnectionStatus } from '@/services/maptiler/MaptilerService';
import { useToast } from '@/hooks/use-toast';

export const MaptilerSettingsPanel = () => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<MaptilerConnectionStatus | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkExistingKey();
  }, []);

  const checkExistingKey = async () => {
    try {
      const existingKey = await maptilerService.getApiKey();
      if (existingKey) {
        setHasExistingKey(true);
        const status = await maptilerService.testConnection();
        setConnectionStatus(status);
      }
    } catch (error) {
      console.error('Error checking existing key:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey && !hasExistingKey) {
      toast({
        title: "Error",
        description: "Please enter an API key to test",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    try {
      const status = await maptilerService.testConnection(apiKey || undefined);
      setConnectionStatus(status);
      
      if (status.connected) {
        toast({
          title: "Success",
          description: "Maptiler connection successful!",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: status.error || "Unable to connect to Maptiler",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test connection",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await maptilerService.saveApiKey(apiKey.trim());
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Maptiler API key saved successfully!",
        });
        setApiKey('');
        setHasExistingKey(true);
        await checkExistingKey();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save API key",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save API key",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!connectionStatus) return null;

    if (connectionStatus.connected) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Connected
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Disconnected
        </Badge>
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle>Maptiler Configuration</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Configure your Maptiler API key for map rendering in the tracking interface.
          Get your API key from{' '}
          <a 
            href="https://cloud.maptiler.com/account/keys/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Maptiler Cloud
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connectionStatus && !connectionStatus.connected && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {connectionStatus.error}
            </AlertDescription>
          </Alert>
        )}

        {connectionStatus && connectionStatus.connected && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Maptiler is configured and working properly. Maps will load with your API key.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="maptiler-key">API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="maptiler-key"
                type="password"
                placeholder={hasExistingKey ? "••••••••••••••••" : "Enter your Maptiler API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={handleTestConnection}
              variant="outline"
              disabled={isTesting}
              className="flex items-center gap-2"
            >
              <TestTube className="h-4 w-4" />
              {isTesting ? 'Testing...' : 'Test'}
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            onClick={handleSaveApiKey}
            disabled={isLoading || !apiKey.trim()}
            className="flex items-center gap-2"
          >
            {isLoading ? 'Saving...' : 'Save API Key'}
          </Button>
        </div>

        {connectionStatus && (
          <div className="text-sm text-muted-foreground border-t pt-4">
            <p>Last checked: {connectionStatus.lastChecked.toLocaleString()}</p>
          </div>
        )}

        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
          <h4 className="font-medium">Setup Instructions:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
            <li>Visit <a href="https://cloud.maptiler.com/account/keys/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Maptiler Cloud</a></li>
            <li>Create a free account or sign in</li>
            <li>Go to Account → Keys section</li>
            <li>Copy your API key</li>
            <li>Paste it above and click Save</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};