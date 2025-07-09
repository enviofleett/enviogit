/**
 * Hook for managing map settings
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MapSettings {
  id?: string;
  serviceProvider: 'maptiler' | 'mapbox' | 'openstreetmap';
  apiKey?: string;
  defaultStyle: string;
  zoomLevel: number;
  centerLat: number;
  centerLng: number;
  isActive: boolean;
}

const DEFAULT_SETTINGS: MapSettings = {
  serviceProvider: 'maptiler',
  defaultStyle: 'streets',
  zoomLevel: 10,
  centerLat: 6.5244, // Lagos, Nigeria
  centerLng: 3.3792,
  isActive: true
};

export const useMapSettings = () => {
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('map_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error loading map settings:', error);
        toast({
          title: "Error",
          description: "Failed to load map settings",
          variant: "destructive"
        });
      } else if (data) {
        setSettings({
          id: data.id,
          serviceProvider: data.service_provider as 'maptiler' | 'mapbox' | 'openstreetmap',
          apiKey: data.api_key || undefined,
          defaultStyle: data.default_style,
          zoomLevel: data.zoom_level,
          centerLat: parseFloat(data.center_lat.toString()),
          centerLng: parseFloat(data.center_lng.toString()),
          isActive: data.is_active
        });
      }
    } catch (error) {
      console.error('Error loading map settings:', error);
      toast({
        title: "Error",
        description: "Failed to load map settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<MapSettings>) => {
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const updatedSettings = { ...settings, ...newSettings };
      
      const upsertData = {
        user_id: user.id,
        service_provider: updatedSettings.serviceProvider,
        api_key: updatedSettings.apiKey,
        default_style: updatedSettings.defaultStyle,
        zoom_level: updatedSettings.zoomLevel,
        center_lat: updatedSettings.centerLat,
        center_lng: updatedSettings.centerLng,
        is_active: updatedSettings.isActive
      };

      const { data, error } = await supabase
        .from('map_settings')
        .upsert(upsertData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setSettings({
        ...updatedSettings,
        id: data.id
      });

      toast({
        title: "Success",
        description: "Map settings saved successfully"
      });

      return true;
    } catch (error) {
      console.error('Error saving map settings:', error);
      toast({
        title: "Error",
        description: "Failed to save map settings",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async (): Promise<boolean> => {
    if (!settings.apiKey) {
      toast({
        title: "Error",
        description: "API key is required for connection test",
        variant: "destructive"
      });
      return false;
    }

    try {
      if (settings.serviceProvider === 'maptiler') {
        const { MapTilerService } = await import('@/services/maps/MapTilerService');
        const isValid = await MapTilerService.testConnection(settings.apiKey);
        
        if (isValid) {
          toast({
            title: "Success",
            description: "Map service connection successful"
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to connect to map service. Check your API key.",
            variant: "destructive"
          });
        }
        
        return isValid;
      }
      
      // Add other service provider tests here
      return false;
    } catch (error) {
      console.error('Connection test error:', error);
      toast({
        title: "Error",
        description: "Connection test failed",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    testConnection,
    reloadSettings: loadSettings
  };
};