
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, TestTube, Trash2 } from 'lucide-react';
import { gps51ConfigService, GPS51Config } from '@/services/gp51/GPS51ConfigService';

export const GPS51CredentialsForm = () => {
  const [formData, setFormData] = useState<GPS51Config>({
    apiUrl: '',
    username: '',
    password: '',
    apiKey: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    error?: string;
    lastTest?: Date;
  }>({ isConnected: false });
  const { toast } = useToast();

  // Load existing configuration on component mount
  useEffect(() => {
    const existingConfig = gps51ConfigService.getConfiguration();
    if (existingConfig) {
      setFormData(existingConfig);
      setIsConfigured(true);
    }
  }, []);

  const handleInputChange = (field: keyof GPS51Config, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.apiUrl || !formData.username || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in API URL, username, and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await gps51ConfigService.saveConfiguration(formData);
      setIsConfigured(true);
      
      toast({
        title: "Settings Saved",
        description: "GPS51 credentials have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.apiUrl || !formData.username || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields before testing.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setConnectionStatus({ isConnected: false });

    try {
      const success = await gps51ConfigService.testConnection(formData);
      
      if (success) {
        setConnectionStatus({
          isConnected: true,
          lastTest: new Date()
        });
        toast({
          title: "Connection Successful",
          description: "Successfully connected to GPS51 API.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionStatus({
        isConnected: false,
        error: errorMessage,
        lastTest: new Date()
      });
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearConfiguration = () => {
    gps51ConfigService.clearConfiguration();
    setFormData({
      apiUrl: '',
      username: '',
      password: '',
      apiKey: ''
    });
    setIsConfigured(false);
    setConnectionStatus({ isConnected: false });
    
    toast({
      title: "Configuration Cleared",
      description: "GPS51 configuration has been removed.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>GPS51 API Configuration</CardTitle>
        <CardDescription>
          Configure your GPS51 API credentials to enable fleet tracking and data synchronization.
          {isConfigured && (
            <span className="block mt-2 text-green-600 text-sm">
              ✅ Configuration saved and ready to use
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiUrl">API URL *</Label>
          <Input
            id="apiUrl"
            type="url"
            placeholder="https://api.gps51.com"
            value={formData.apiUrl}
            onChange={(e) => handleInputChange('apiUrl', e.target.value)}
          />
          <p className="text-xs text-gray-500">
            The base URL for your GPS51 API endpoint
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            type="text"
            placeholder="Your GPS51 username"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Your GPS51 password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="text"
            placeholder="Your GPS51 API key (optional)"
            value={formData.apiKey}
            onChange={(e) => handleInputChange('apiKey', e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Optional API key if required by your GPS51 provider
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
          
          <Button 
            onClick={handleTestConnection}
            disabled={isTesting || !formData.apiUrl || !formData.username || !formData.password}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>

          {isConfigured && (
            <Button 
              onClick={handleClearConfiguration}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Connection Status Display */}
        {connectionStatus.lastTest && (
          <div className={`mt-4 p-3 border rounded-md ${
            connectionStatus.isConnected 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm ${
              connectionStatus.isConnected ? 'text-green-800' : 'text-red-800'
            }`}>
              {connectionStatus.isConnected ? (
                <>
                  ✅ Connected to GPS51 API
                  <span className="block text-xs mt-1">
                    Last tested: {connectionStatus.lastTest.toLocaleString()}
                  </span>
                </>
              ) : (
                <>
                  ❌ Connection failed
                  {connectionStatus.error && (
                    <span className="block text-xs mt-1">
                      Error: {connectionStatus.error}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        )}

        {/* Configuration Status */}
        {isConfigured && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              📡 GPS51 integration is configured and ready
              <span className="block text-xs text-blue-600 mt-1">
                You can now use GPS51 features throughout the application
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
