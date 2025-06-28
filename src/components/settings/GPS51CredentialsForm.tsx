
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, TestTube, Trash2, CheckCircle } from 'lucide-react';
import { gps51ConfigService, GPS51Config } from '@/services/gp51/GPS51ConfigService';

export const GPS51CredentialsForm = () => {
  const [formData, setFormData] = useState<GPS51Config>({
    apiUrl: 'https://api.gps51.com/webapi',
    username: '',
    password: '',
    apiKey: '',
    from: 'WEB',
    type: 'USER'
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    error?: string;
    lastTest?: Date;
    userInfo?: any;
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
        const authService = gps51ConfigService['authService'];
        const userInfo = authService.getUser();
        
        setConnectionStatus({
          isConnected: true,
          lastTest: new Date(),
          userInfo
        });
        
        toast({
          title: "Connection Successful",
          description: `Successfully connected to GPS51 API${userInfo ? ` as ${userInfo.showname || userInfo.username}` : ''}.`,
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
      apiUrl: 'https://api.gps51.com/webapi',
      username: '',
      password: '',
      apiKey: '',
      from: 'WEB',
      type: 'USER'
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
        <CardTitle className="flex items-center gap-2">
          GPS51 API Configuration
          {isConfigured && connectionStatus.isConnected && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
        </CardTitle>
        <CardDescription>
          Configure your GPS51 API credentials to enable real-time fleet tracking and data synchronization.
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
            placeholder="https://api.gps51.com/webapi"
            value={formData.apiUrl}
            onChange={(e) => handleInputChange('apiUrl', e.target.value)}
          />
          <p className="text-xs text-gray-500">
            The base URL for your GPS51 API endpoint
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="from">Platform *</Label>
            <Select value={formData.from} onValueChange={(value: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') => handleInputChange('from', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEB">Web</SelectItem>
                <SelectItem value="ANDROID">Android</SelectItem>
                <SelectItem value="IPHONE">iPhone</SelectItem>
                <SelectItem value="WEIXIN">WeChat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Login Type *</Label>
            <Select value={formData.type} onValueChange={(value: 'USER' | 'DEVICE') => handleInputChange('type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User Account</SelectItem>
                <SelectItem value="DEVICE">Device Login</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            type="text"
            placeholder="Your GPS51 username or device ID"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Supports Chinese/English characters, username or device ID
          </p>
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
          <p className="text-xs text-gray-500">
            Password will be automatically encrypted using MD5
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key (Optional)</Label>
          <Input
            id="apiKey"
            type="text"
            placeholder="Your GPS51 API key if required"
            value={formData.apiKey || ''}
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
                  {connectionStatus.userInfo && (
                    <span className="block text-xs mt-1">
                      Logged in as: {connectionStatus.userInfo.showname || connectionStatus.userInfo.username}
                      {connectionStatus.userInfo.companyname && ` (${connectionStatus.userInfo.companyname})`}
                    </span>
                  )}
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
                Platform: {formData.from} | Type: {formData.type}
              </span>
              <span className="block text-xs text-blue-600">
                You can now use GPS51 features throughout the application
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
