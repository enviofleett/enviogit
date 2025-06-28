
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, TestTube, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';

export const GPS51CredentialsForm = () => {
  const [formData, setFormData] = useState({
    apiUrl: 'https://www.gps51.com/webapi',
    username: '',
    password: '',
    apiKey: '',
    from: 'WEB' as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN',
    type: 'USER' as 'USER' | 'DEVICE'
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const { toast } = useToast();
  const { status, connect, disconnect, refresh } = useGPS51SessionBridge();

  // Load saved configuration on component mount
  useEffect(() => {
    const loadConfiguration = () => {
      const savedConfig = {
        apiUrl: localStorage.getItem('gps51_api_url') || 'https://www.gps51.com/webapi',
        username: localStorage.getItem('gps51_username') || '',
        from: (localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
        type: (localStorage.getItem('gps51_type') as 'USER' | 'DEVICE') || 'USER',
        apiKey: localStorage.getItem('gps51_api_key') || ''
      };
      
      setFormData(prev => ({
        ...prev,
        ...savedConfig
      }));
    };

    loadConfiguration();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.apiUrl || !formData.username || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in API URL, username, and password.",
        variant: "destructive",
      });
      return false;
    }

    // Basic URL validation
    try {
      new URL(formData.apiUrl);
    } catch {
      toast({
        title: "Invalid API URL",
        description: "Please enter a valid API URL.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      console.log('Saving GPS51 credentials...');
      const success = await connect(formData);
      
      if (success) {
        toast({
          title: "Settings Saved",
          description: "GPS51 credentials have been saved and authenticated successfully.",
        });
        
        // Clear password field for security
        setFormData(prev => ({ ...prev, password: '' }));
      } else {
        toast({
          title: "Connection Failed",
          description: status.error || "Failed to authenticate with GPS51.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Save credentials error:', error);
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
    if (!validateForm()) return;

    setIsTesting(true);
    try {
      console.log('Testing GPS51 connection...');
      const success = await connect(formData);
      
      if (success) {
        toast({
          title: "Connection Successful",
          description: "Successfully connected to GPS51 API.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: status.error || "Failed to connect to GPS51 API.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : 'Connection failed',
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncData = async () => {
    if (!status.isAuthenticated) {
      toast({
        title: "Not Authenticated",
        description: "Please save and connect first before syncing data.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Syncing GPS51 data...');
      const result = await refresh();
      
      toast({
        title: "Sync Successful",
        description: `Synced ${result.vehiclesSynced} vehicles and ${result.positionsStored} positions.`,
      });
    } catch (error) {
      console.error('Sync data error:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : 'Data sync failed',
        variant: "destructive",
      });
    }
  };

  const handleClearConfiguration = () => {
    disconnect();
    setFormData({
      apiUrl: 'https://www.gps51.com/webapi',
      username: '',
      password: '',
      apiKey: '',
      from: 'WEB',
      type: 'USER'
    });
    
    toast({
      title: "Configuration Cleared",
      description: "GPS51 configuration has been removed.",
    });
  };

  const getConnectionStatusIcon = () => {
    if (status.isAuthenticated && status.connectionHealth === 'good') {
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
        </CardTitle>
        <CardDescription>
          Configure your GPS51 API credentials to enable real-time fleet tracking and data synchronization.
          {status.isConfigured && (
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
            placeholder="https://www.gps51.com/webapi"
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
          <p className="text-xs text-gray-500">
            Password will be automatically encrypted using MD5
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave}
            disabled={isLoading || isTesting}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : 'Save & Connect'}
          </Button>
          
          <Button 
            onClick={handleTestConnection}
            disabled={isTesting || isLoading || !formData.apiUrl || !formData.username || !formData.password}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>

          {status.isAuthenticated && (
            <Button 
              onClick={handleSyncData}
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
              onClick={handleClearConfiguration}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Enhanced Status Display */}
        {status.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              ❌ Connection failed: {status.error}
            </p>
          </div>
        )}

        {status.isAuthenticated && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✅ Connected to GPS51 API
              <span className="block text-xs mt-1">
                Connection Health: {status.connectionHealth.toUpperCase()}
              </span>
              <span className="block text-xs mt-1">
                Sync Status: {status.syncStatus.toUpperCase()}
              </span>
              {status.lastSync && (
                <span className="block text-xs mt-1">
                  Last sync: {status.lastSync.toLocaleString()}
                </span>
              )}
            </p>
          </div>
        )}

        {status.syncStatus === 'syncing' && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              🔄 Syncing data from GPS51...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
