
import { supabase } from '@/integrations/supabase/client';

export interface GPS51Config {
  apiUrl: string;
  username: string;
  password: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
}

class GPS51ConfigService {
  private config: GPS51Config | null = null;
  private readonly STORAGE_KEY = 'gps51_config';
  private readonly SUPABASE_TABLE = 'gps51_settings';

  /**
   * Get GPS51 configuration from multiple sources
   * Priority: 1. Memory cache, 2. Supabase, 3. localStorage
   */
  async getConfig(): Promise<GPS51Config | null> {
    console.log('GPS51ConfigService: Getting configuration...');

    // Return cached config if available
    if (this.config) {
      console.log('GPS51ConfigService: Using cached config');
      return this.config;
    }

    try {
      // Try to get from Supabase first
      const { data: supabaseConfig, error } = await supabase
        .from(this.SUPABASE_TABLE)
        .select('*')
        .eq('active', true)
        .single();

      if (!error && supabaseConfig) {
        console.log('GPS51ConfigService: Found config in Supabase');
        this.config = {
          apiUrl: supabaseConfig.api_url || 'https://api.gps51.com/openapi',
          username: supabaseConfig.username,
          password: supabaseConfig.password_hash,
          from: (supabaseConfig.from as any) || 'WEB',
          type: (supabaseConfig.type as any) || 'USER'
        };
        return this.config;
      }
    } catch (error) {
      console.warn('GPS51ConfigService: Could not fetch from Supabase:', error);
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        console.log('GPS51ConfigService: Found config in localStorage');
        this.config = JSON.parse(stored);
        return this.config;
      }
    } catch (error) {
      console.warn('GPS51ConfigService: Could not parse localStorage config:', error);
    }

    console.log('GPS51ConfigService: No configuration found');
    return null;
  }

  /**
   * Save GPS51 configuration to multiple locations
   */
  async setConfig(config: GPS51Config): Promise<void> {
    console.log('GPS51ConfigService: Saving configuration...');
    
    // Ensure API URL uses the new openapi endpoint
    const updatedConfig = {
      ...config,
      apiUrl: config.apiUrl.replace('/webapi', '/openapi')
    };

    // Update memory cache
    this.config = updatedConfig;

    try {
      // Save to Supabase
      const { error } = await supabase
        .from(this.SUPABASE_TABLE)
        .upsert({
          api_url: updatedConfig.apiUrl,
          username: updatedConfig.username,
          password_hash: updatedConfig.password,
          from: updatedConfig.from,
          type: updatedConfig.type,
          active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'username'
        });

      if (error) {
        console.warn('GPS51ConfigService: Could not save to Supabase:', error);
      } else {
        console.log('GPS51ConfigService: Successfully saved to Supabase');
      }
    } catch (error) {
      console.warn('GPS51ConfigService: Supabase save error:', error);
    }

    // Also save to localStorage as backup
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedConfig));
      console.log('GPS51ConfigService: Successfully saved to localStorage');
    } catch (error) {
      console.warn('GPS51ConfigService: Could not save to localStorage:', error);
    }
  }

  /**
   * Check if GPS51 is properly configured
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    const isConfigured = !!(
      config?.apiUrl && 
      config?.username && 
      config?.password &&
      config?.from &&
      config?.type
    );

    console.log('GPS51ConfigService: Configuration check:', {
      hasConfig: !!config,
      hasApiUrl: !!config?.apiUrl,
      hasUsername: !!config?.username,
      hasPassword: !!config?.password,
      hasFro: !!config?.from,
      hasType: !!config?.type,
      isConfigured
    });

    return isConfigured;
  }

  /**
   * Synchronous check (uses cached config only)
   */
  isConfiguredSync(): boolean {
    const isConfigured = !!(
      this.config?.apiUrl && 
      this.config?.username && 
      this.config?.password &&
      this.config?.from &&
      this.config?.type
    );

    console.log('GPS51ConfigService: Sync configuration check:', {
      hasConfig: !!this.config,
      hasApiUrl: !!this.config?.apiUrl,
      hasUsername: !!this.config?.username,
      hasPassword: !!this.config?.password,
      hasFrom: !!this.config?.from,
      hasType: !!this.config?.type,
      isConfigured
    });

    return isConfigured;
  }

  /**
   * Clear all stored configuration
   */
  async clearConfig(): Promise<void> {
    console.log('GPS51ConfigService: Clearing configuration...');
    
    this.config = null;

    try {
      // Clear from Supabase
      await supabase
        .from(this.SUPABASE_TABLE)
        .update({ active: false })
        .eq('active', true);
    } catch (error) {
      console.warn('GPS51ConfigService: Could not clear Supabase config:', error);
    }

    try {
      // Clear from localStorage
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('GPS51ConfigService: Could not clear localStorage:', error);
    }

    console.log('GPS51ConfigService: Configuration cleared');
  }

  /**
   * Initialize configuration from authentication service
   */
  async initializeFromAuth(): Promise<void> {
    console.log('GPS51ConfigService: Initializing from authentication...');
    
    // Force reload configuration from storage
    this.config = null;
    await this.getConfig();
  }

  /**
   * Get configuration for API calls
   */
  async getCredentials() {
    const config = await this.getConfig();
    if (!config) {
      throw new Error('GPS51 not configured');
    }

    return {
      username: config.username,
      password: config.password,
      from: config.from,
      type: config.type,
      apiUrl: config.apiUrl
    };
  }
}

export const gps51ConfigService = new GPS51ConfigService();
