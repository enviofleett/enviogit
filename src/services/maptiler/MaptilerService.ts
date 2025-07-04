import { supabase } from '@/integrations/supabase/client';

export interface MaptilerConfig {
  apiKey: string;
  isValid: boolean;
  lastTested?: Date;
}

export interface MaptilerConnectionStatus {
  connected: boolean;
  error?: string;
  lastChecked: Date;
}

class MaptilerService {
  private apiKey: string | null = null;
  private lastFetched: Date | null = null;
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get Maptiler API key from Supabase secrets
   */
  async getApiKey(): Promise<string | null> {
    try {
      // Return cached key if still valid
      if (this.apiKey && this.lastFetched && 
          Date.now() - this.lastFetched.getTime() < this.cacheTimeout) {
        return this.apiKey;
      }

      // Fetch from edge function that has access to secrets
      const { data, error } = await supabase.functions.invoke('get-maptiler-key');
      
      if (error) {
        console.error('Failed to fetch Maptiler API key:', error);
        return null;
      }

      if (data?.apiKey) {
        this.apiKey = data.apiKey;
        this.lastFetched = new Date();
        return this.apiKey;
      }

      return null;
    } catch (error) {
      console.error('Error fetching Maptiler API key:', error);
      return null;
    }
  }

  /**
   * Test Maptiler API key validity
   */
  async testConnection(apiKey?: string): Promise<MaptilerConnectionStatus> {
    const keyToTest = apiKey || await this.getApiKey();
    
    if (!keyToTest) {
      return {
        connected: false,
        error: 'No API key configured',
        lastChecked: new Date()
      };
    }

    try {
      // Test with a simple map style request
      const response = await fetch(
        `https://api.maptiler.com/maps/streets/style.json?key=${keyToTest}`,
        { method: 'HEAD' }
      );

      if (response.ok) {
        return {
          connected: true,
          lastChecked: new Date()
        };
      } else if (response.status === 401 || response.status === 403) {
        return {
          connected: false,
          error: 'Invalid API key',
          lastChecked: new Date()
        };
      } else {
        return {
          connected: false,
          error: `API error: ${response.status}`,
          lastChecked: new Date()
        };
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: new Date()
      };
    }
  }

  /**
   * Save Maptiler API key to Supabase secrets
   */
  async saveApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // First test the key
      const testResult = await this.testConnection(apiKey);
      if (!testResult.connected) {
        return {
          success: false,
          error: testResult.error || 'Invalid API key'
        };
      }

      // Save to secrets via edge function
      const { error } = await supabase.functions.invoke('save-maptiler-key', {
        body: { apiKey }
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Failed to save API key'
        };
      }

      // Clear cache to force refresh
      this.apiKey = null;
      this.lastFetched = null;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get map style URL with API key
   */
  async getStyleUrl(style: 'streets' | 'satellite' = 'streets'): Promise<string | null> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return null;
    }
    return `https://api.maptiler.com/maps/${style}/style.json?key=${apiKey}`;
  }

  /**
   * Log API usage for monitoring
   */
  async logUsage(feature: string): Promise<void> {
    try {
      await supabase.from('map_api_usage').insert({
        feature_used: feature,
        count: 1
      });
    } catch (error) {
      console.warn('Failed to log map API usage:', error);
    }
  }

  /**
   * Clear cached API key
   */
  clearCache(): void {
    this.apiKey = null;
    this.lastFetched = null;
  }
}

export const maptilerService = new MaptilerService();