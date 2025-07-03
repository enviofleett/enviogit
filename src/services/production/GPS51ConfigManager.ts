// GPS51 Config Manager - Phase 4.5
// Environment-specific configuration management

import { supabase } from '@/integrations/supabase/client';

export interface GPS51Environment {
  name: 'development' | 'staging' | 'production';
  apiUrl: string;
  maxRetries: number;
  timeoutMs: number;
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  caching: {
    enabled: boolean;
    ttlSeconds: number;
    maxSize: number;
  };
  monitoring: {
    enabled: boolean;
    sampleRate: number;
    errorReporting: boolean;
  };
  features: {
    realTimeUpdates: boolean;
    batchOperations: boolean;
    advancedAnalytics: boolean;
    geofencing: boolean;
  };
}

export interface GPS51DeploymentConfig {
  version: string;
  deployedAt: string;
  buildHash: string;
  environment: GPS51Environment;
  healthChecks: {
    enabled: boolean;
    intervalMs: number;
    endpoints: string[];
  };
  backup: {
    enabled: boolean;
    intervalHours: number;
    retentionDays: number;
  };
}

export class GPS51ConfigManager {
  private static instance: GPS51ConfigManager;
  private currentConfig: GPS51DeploymentConfig | null = null;
  private environments: Record<string, GPS51Environment> = {};

  static getInstance(): GPS51ConfigManager {
    if (!GPS51ConfigManager.instance) {
      GPS51ConfigManager.instance = new GPS51ConfigManager();
    }
    return GPS51ConfigManager.instance;
  }

  constructor() {
    this.initializeEnvironments();
    this.loadCurrentConfig();
  }

  private initializeEnvironments(): void {
    this.environments = {
      development: {
        name: 'development',
        apiUrl: 'https://api.gps51.com/openapi',
        maxRetries: 3,
        timeoutMs: 10000,
        rateLimits: {
          requestsPerSecond: 5,
          requestsPerMinute: 100,
          requestsPerHour: 1000
        },
        caching: {
          enabled: true,
          ttlSeconds: 300,
          maxSize: 100
        },
        monitoring: {
          enabled: true,
          sampleRate: 1.0,
          errorReporting: true
        },
        features: {
          realTimeUpdates: true,
          batchOperations: true,
          advancedAnalytics: true,
          geofencing: true
        }
      },
      staging: {
        name: 'staging',
        apiUrl: 'https://api.gps51.com/openapi',
        maxRetries: 3,
        timeoutMs: 8000,
        rateLimits: {
          requestsPerSecond: 10,
          requestsPerMinute: 300,
          requestsPerHour: 5000
        },
        caching: {
          enabled: true,
          ttlSeconds: 180,
          maxSize: 500
        },
        monitoring: {
          enabled: true,
          sampleRate: 0.5,
          errorReporting: true
        },
        features: {
          realTimeUpdates: true,
          batchOperations: true,
          advancedAnalytics: true,
          geofencing: true
        }
      },
      production: {
        name: 'production',
        apiUrl: 'https://api.gps51.com/openapi',
        maxRetries: 5,
        timeoutMs: 5000,
        rateLimits: {
          requestsPerSecond: 20,
          requestsPerMinute: 600,
          requestsPerHour: 10000
        },
        caching: {
          enabled: true,
          ttlSeconds: 60,
          maxSize: 1000
        },
        monitoring: {
          enabled: true,
          sampleRate: 0.1,
          errorReporting: true
        },
        features: {
          realTimeUpdates: true,
          batchOperations: true,
          advancedAnalytics: true,
          geofencing: true
        }
      }
    };
  }

  private async loadCurrentConfig(): Promise<void> {
    try {
      // Detect environment based on URL or environment variables
      const hostname = window.location.hostname;
      let environmentName: string;

      if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        environmentName = 'development';
      } else if (hostname.includes('staging') || hostname.includes('preview')) {
        environmentName = 'staging';
      } else {
        environmentName = 'production';
      }

      const environment = this.environments[environmentName];
      if (!environment) {
        throw new Error(`Unknown environment: ${environmentName}`);
      }

      this.currentConfig = {
        version: '1.0.0',
        deployedAt: new Date().toISOString(),
        buildHash: this.generateBuildHash(),
        environment,
        healthChecks: {
          enabled: environmentName !== 'development',
          intervalMs: 30000,
          endpoints: [
            '/api/health',
            'https://api.gps51.com/openapi/health'
          ]
        },
        backup: {
          enabled: environmentName === 'production',
          intervalHours: 24,
          retentionDays: 30
        }
      };

      console.log('GPS51ConfigManager: Configuration loaded for environment:', environmentName);
    } catch (error) {
      console.error('GPS51ConfigManager: Failed to load configuration:', error);
      // Fallback to development config
      this.currentConfig = {
        version: '1.0.0',
        deployedAt: new Date().toISOString(),
        buildHash: 'unknown',
        environment: this.environments.development,
        healthChecks: {
          enabled: false,
          intervalMs: 60000,
          endpoints: []
        },
        backup: {
          enabled: false,
          intervalHours: 24,
          retentionDays: 7
        }
      };
    }
  }

  private generateBuildHash(): string {
    // Generate a simple build hash based on timestamp
    return btoa(Date.now().toString()).substring(0, 8);
  }

  // Public API
  getCurrentConfig(): GPS51DeploymentConfig | null {
    return this.currentConfig;
  }

  getEnvironment(): GPS51Environment | null {
    return this.currentConfig?.environment || null;
  }

  getEnvironmentName(): string {
    return this.currentConfig?.environment.name || 'unknown';
  }

  isProduction(): boolean {
    return this.getEnvironmentName() === 'production';
  }

  isDevelopment(): boolean {
    return this.getEnvironmentName() === 'development';
  }

  isStaging(): boolean {
    return this.getEnvironmentName() === 'staging';
  }

  getFeatureFlag(feature: keyof GPS51Environment['features']): boolean {
    return this.currentConfig?.environment.features[feature] || false;
  }

  getRateLimit(type: 'second' | 'minute' | 'hour'): number {
    const limits = this.currentConfig?.environment.rateLimits;
    if (!limits) return 0;

    switch (type) {
      case 'second': return limits.requestsPerSecond;
      case 'minute': return limits.requestsPerMinute;
      case 'hour': return limits.requestsPerHour;
      default: return 0;
    }
  }

  getCacheConfig(): GPS51Environment['caching'] | null {
    return this.currentConfig?.environment.caching || null;
  }

  getMonitoringConfig(): GPS51Environment['monitoring'] | null {
    return this.currentConfig?.environment.monitoring || null;
  }

  // Configuration validation
  async validateConfiguration(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.currentConfig) {
      errors.push('No configuration loaded');
      return { valid: false, errors, warnings };
    }

    const config = this.currentConfig;

    // Validate environment
    if (!config.environment.apiUrl) {
      errors.push('API URL is not configured');
    }

    if (config.environment.maxRetries < 1) {
      warnings.push('Max retries is less than 1, this may cause issues');
    }

    if (config.environment.timeoutMs < 1000) {
      warnings.push('Timeout is less than 1 second, this may be too aggressive');
    }

    // Validate rate limits
    const limits = config.environment.rateLimits;
    if (limits.requestsPerSecond * 60 > limits.requestsPerMinute) {
      warnings.push('Rate limit inconsistency: per-second limit exceeds per-minute capacity');
    }

    // Validate production-specific settings
    if (this.isProduction()) {
      if (!config.healthChecks.enabled) {
        warnings.push('Health checks should be enabled in production');
      }

      if (!config.backup.enabled) {
        warnings.push('Backups should be enabled in production');
      }

      if (config.environment.monitoring.sampleRate > 0.2) {
        warnings.push('High monitoring sample rate in production may impact performance');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Configuration updates
  async updateEnvironmentConfig(updates: Partial<GPS51Environment>): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('No configuration loaded');
    }

    this.currentConfig.environment = {
      ...this.currentConfig.environment,
      ...updates
    };

    console.log('GPS51ConfigManager: Environment configuration updated');
  }

  // Configuration persistence
  async saveConfiguration(): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('No configuration to save');
    }

    try {
      const configData = {
        config: this.currentConfig,
        saved_at: new Date().toISOString()
      };

      localStorage.setItem('gps51_deployment_config', JSON.stringify(configData));
      console.log('GPS51ConfigManager: Configuration saved to local storage');
    } catch (error) {
      console.error('GPS51ConfigManager: Failed to save configuration:', error);
      throw error;
    }
  }

  async loadSavedConfiguration(): Promise<void> {
    try {
      const savedConfig = localStorage.getItem('gps51_deployment_config');
      if (savedConfig) {
        const configData = JSON.parse(savedConfig);
        this.currentConfig = configData.config;
        console.log('GPS51ConfigManager: Configuration loaded from local storage');
      }
    } catch (error) {
      console.error('GPS51ConfigManager: Failed to load saved configuration:', error);
    }
  }

  // Deployment information
  getDeploymentInfo(): {
    version: string;
    environment: string;
    deployedAt: string;
    buildHash: string;
    uptime: string;
  } {
    const config = this.currentConfig;
    if (!config) {
      return {
        version: 'unknown',
        environment: 'unknown',
        deployedAt: 'unknown',
        buildHash: 'unknown',
        uptime: 'unknown'
      };
    }

    const deployedAt = new Date(config.deployedAt);
    const uptime = Math.floor((Date.now() - deployedAt.getTime()) / 1000);

    return {
      version: config.version,
      environment: config.environment.name,
      deployedAt: config.deployedAt,
      buildHash: config.buildHash,
      uptime: this.formatUptime(uptime)
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}

// Create singleton instance
export const gps51ConfigManager = GPS51ConfigManager.getInstance();