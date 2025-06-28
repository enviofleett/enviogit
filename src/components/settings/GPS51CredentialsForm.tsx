
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Save, TestTube } from 'lucide-react';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';

export const GPS51CredentialsForm = () => {
  const [formData, setFormData] = useState({
    apiUrl: localStorage.getItem('gps51_api_url') || '',
    username: localStorage.getItem('gps51_username') || '',
    password: localStorage.getItem('gps51_password') || '',
    apiKey: localStorage.getItem('gps51_api_key') || ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();
  const { connect, status } = useGPS51SessionBridge();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    setIsLoading(true);
    try {
      // Save credentials to localStorage
      localStorage.setItem('gps51_api_url', formData.apiUrl);
      localStorage.setItem('gps51_username', formData.username);
      localStorage.setItem('gps51_password', formData.password);
      localStorage.setItem('gps51_api_key', formData.apiKey);
      
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
    try {
      const success = await connect({
        username: formData.username,
        password: formData.password,
        apiKey: formData.apiKey
      });

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
      toast({
        title: "Connection Error",
        description: "An error occurred while testing the connection.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>GPS51 API Configuration</CardTitle>
        <CardDescription>
          Configure your GPS51 API credentials to enable fleet tracking and data synchronization.
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
            disabled={isTesting}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>

        {status.isAuthenticated && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✅ Connected to GPS51 API
              {status.lastSync && (
                <span className="block text-xs text-green-600 mt-1">
                  Last sync: {status.lastSync.toLocaleString()}
                </span>
              )}
            </p>
          </div>
        )}
        
        {status.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              ❌ {status.error}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
