/**
 * Map Settings Panel Component
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Map, TestTube, Key, Globe, Settings, Eye, EyeOff } from 'lucide-react';
import { useMapSettings } from '@/hooks/useMapSettings';

export const MapSettingsPanel: React.FC = () => {
  const { settings, isLoading, isSaving, saveSettings, testConnection } = useMapSettings();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [formData, setFormData] = useState(settings);

  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async () => {
    await saveSettings(formData);
  };

  const handleTest = async () => {
    setIsTesting(true);
    await testConnection();
    setIsTesting(false);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Map className="w-5 h-5" />
          <span>Map Service Settings</span>
        </CardTitle>
        <CardDescription>
          Configure your preferred map service provider and appearance settings
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Service Provider Selection */}
        <div className="space-y-3">
          <Label htmlFor="service-provider" className="text-base font-medium">
            Map Service Provider
          </Label>
          <Select
            value={formData.serviceProvider}
            onValueChange={(value) => handleInputChange('serviceProvider', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select map provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maptiler">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" />
                  <span>MapTiler</span>
                  <Badge variant="default" className="ml-2">Recommended</Badge>
                </div>
              </SelectItem>
              <SelectItem value="mapbox">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" />
                  <span>Mapbox</span>
                </div>
              </SelectItem>
              <SelectItem value="openstreetmap">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" />
                  <span>OpenStreetMap</span>
                  <Badge variant="secondary" className="ml-2">Free</Badge>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* API Key Configuration */}
        {formData.serviceProvider !== 'openstreetmap' && (
          <div className="space-y-3">
            <Label htmlFor="api-key" className="text-base font-medium flex items-center space-x-2">
              <Key className="w-4 h-4" />
              <span>API Key</span>
            </Label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={formData.apiKey || ''}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  placeholder={`Enter your ${formData.serviceProvider} API key`}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={!formData.apiKey || isTesting}
                className="flex items-center space-x-2"
              >
                <TestTube className="w-4 h-4" />
                <span>{isTesting ? 'Testing...' : 'Test'}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formData.serviceProvider === 'maptiler' && (
                <>Get your free API key from <a href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MapTiler.com</a></>
              )}
              {formData.serviceProvider === 'mapbox' && (
                <>Get your API key from <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mapbox Account</a></>
              )}
            </p>
          </div>
        )}

        <Separator />

        {/* Map Style Settings */}
        <div className="space-y-3">
          <Label htmlFor="default-style" className="text-base font-medium flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Default Map Style</span>
          </Label>
          <Select
            value={formData.defaultStyle}
            onValueChange={(value) => handleInputChange('defaultStyle', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select map style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="streets">Streets</SelectItem>
              <SelectItem value="satellite">Satellite</SelectItem>
              <SelectItem value="terrain">Terrain</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Default Location Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="zoom-level">Default Zoom Level</Label>
            <Input
              id="zoom-level"
              type="number"
              min="1"
              max="20"
              value={formData.zoomLevel}
              onChange={(e) => handleInputChange('zoomLevel', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="center-lat">Center Latitude</Label>
            <Input
              id="center-lat"
              type="number"
              step="0.0001"
              value={formData.centerLat}
              onChange={(e) => handleInputChange('centerLat', parseFloat(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="center-lng">Center Longitude</Label>
            <Input
              id="center-lng"
              type="number"
              step="0.0001"
              value={formData.centerLng}
              onChange={(e) => handleInputChange('centerLng', parseFloat(e.target.value))}
            />
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-2"
          >
            {isSaving && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </Button>
        </div>

        {/* Service Information */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">Current Configuration</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Provider: <span className="font-medium">{formData.serviceProvider}</span></div>
            <div>Style: <span className="font-medium">{formData.defaultStyle}</span></div>
            <div>Zoom: <span className="font-medium">{formData.zoomLevel}</span></div>
            <div>API Key: <span className="font-medium">{formData.apiKey ? 'Configured' : 'Not set'}</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};