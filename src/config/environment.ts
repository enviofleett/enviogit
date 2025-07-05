// Production Environment Configuration System
export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  environment: Environment;
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    rateLimit: {
      requestsPerMinute: number;
      burstLimit: number;
    };
  };
  monitoring: {
    enabled: boolean;
    healthCheckInterval: number;
    performanceTrackingEnabled: boolean;
    errorReportingEnabled: boolean;
    metricsCollectionInterval: number;
  };
  features: {
    realTimeUpdates: boolean;
    advancedAnalytics: boolean;
    debugMode: boolean;
    maintenanceMode: boolean;
    betaFeatures: boolean;
  };
  security: {
    rateLimitingEnabled: boolean;
    requestSigningEnabled: boolean;
    corsStrict: boolean;
    auditLoggingEnabled: boolean;
  };
  performance: {
    cacheEnabled: boolean;
    cacheTtl: number;
    prefetchEnabled: boolean;
    lazyLoadingEnabled: boolean;
  };
  alerts: {
    enabled: boolean;
    channels: ('email' | 'sms' | 'slack' | 'webhook')[];
    thresholds: {
      errorRate: number;
      responseTime: number;
      availability: number;
    };
  };
}

// Environment-specific configurations
const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  development: {
    environment: 'development',
    api: {
      baseUrl: 'http://localhost:54321',
      timeout: 30000,
      retryAttempts: 2,
      rateLimit: {
        requestsPerMinute: 1000,
        burstLimit: 100
      }
    },
    monitoring: {
      enabled: true,
      healthCheckInterval: 60000,
      performanceTrackingEnabled: true,
      errorReportingEnabled: true,
      metricsCollectionInterval: 30000
    },
    features: {
      realTimeUpdates: true,
      advancedAnalytics: true,
      debugMode: true,
      maintenanceMode: false,
      betaFeatures: true
    },
    security: {
      rateLimitingEnabled: false,
      requestSigningEnabled: false,
      corsStrict: false,
      auditLoggingEnabled: true
    },
    performance: {
      cacheEnabled: true,
      cacheTtl: 300000, // 5 minutes
      prefetchEnabled: false,
      lazyLoadingEnabled: true
    },
    alerts: {
      enabled: false,
      channels: ['email'],
      thresholds: {
        errorRate: 10,
        responseTime: 5000,
        availability: 95
      }
    }
  },
  
  staging: {
    environment: 'staging',
    api: {
      baseUrl: 'https://hdeubumvuceqbehoekuw.supabase.co',
      timeout: 15000,
      retryAttempts: 3,
      rateLimit: {
        requestsPerMinute: 500,
        burstLimit: 50
      }
    },
    monitoring: {
      enabled: true,
      healthCheckInterval: 30000,
      performanceTrackingEnabled: true,
      errorReportingEnabled: true,
      metricsCollectionInterval: 15000
    },
    features: {
      realTimeUpdates: true,
      advancedAnalytics: true,
      debugMode: false,
      maintenanceMode: false,
      betaFeatures: true
    },
    security: {
      rateLimitingEnabled: true,
      requestSigningEnabled: true,
      corsStrict: true,
      auditLoggingEnabled: true
    },
    performance: {
      cacheEnabled: true,
      cacheTtl: 600000, // 10 minutes
      prefetchEnabled: true,
      lazyLoadingEnabled: true
    },
    alerts: {
      enabled: true,
      channels: ['email', 'webhook'],
      thresholds: {
        errorRate: 5,
        responseTime: 3000,
        availability: 98
      }
    }
  },
  
  production: {
    environment: 'production',
    api: {
      baseUrl: 'https://hdeubumvuceqbehoekuw.supabase.co',
      timeout: 10000,
      retryAttempts: 5,
      rateLimit: {
        requestsPerMinute: 200,
        burstLimit: 20
      }
    },
    monitoring: {
      enabled: true,
      healthCheckInterval: 15000,
      performanceTrackingEnabled: true,
      errorReportingEnabled: true,
      metricsCollectionInterval: 10000
    },
    features: {
      realTimeUpdates: true,
      advancedAnalytics: true,
      debugMode: false,
      maintenanceMode: false,
      betaFeatures: false
    },
    security: {
      rateLimitingEnabled: true,
      requestSigningEnabled: true,
      corsStrict: true,
      auditLoggingEnabled: true
    },
    performance: {
      cacheEnabled: true,
      cacheTtl: 1800000, // 30 minutes
      prefetchEnabled: true,
      lazyLoadingEnabled: true
    },
    alerts: {
      enabled: true,
      channels: ['email', 'sms', 'slack', 'webhook'],
      thresholds: {
        errorRate: 1,
        responseTime: 2000,
        availability: 99.9
      }
    }
  }
};

// Detect current environment
function detectEnvironment(): Environment {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  
  if (hostname.includes('staging') || hostname.includes('preview')) {
    return 'staging';
  }
  
  return 'production';
}

// Get current environment configuration
export function getEnvironmentConfig(): EnvironmentConfig {
  const env = detectEnvironment();
  return ENVIRONMENT_CONFIGS[env];
}

// Environment-aware feature flags
export function isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
  const config = getEnvironmentConfig();
  return config.features[feature];
}

// Environment-aware API configuration
export function getApiConfig() {
  const config = getEnvironmentConfig();
  return config.api;
}

// Environment-aware monitoring configuration
export function getMonitoringConfig() {
  const config = getEnvironmentConfig();
  return config.monitoring;
}

// Environment-aware security configuration
export function getSecurityConfig() {
  const config = getEnvironmentConfig();
  return config.security;
}

// Environment-aware performance configuration
export function getPerformanceConfig() {
  const config = getEnvironmentConfig();
  return config.performance;
}

// Environment-aware alerts configuration
export function getAlertsConfig() {
  const config = getEnvironmentConfig();
  return config.alerts;
}

// Current environment info
export function getCurrentEnvironment(): Environment {
  return detectEnvironment();
}

// Is production environment
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

// Is development environment
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

// Is staging environment
export function isStaging(): boolean {
  return getCurrentEnvironment() === 'staging';
}

// Environment banner component props
export function getEnvironmentBanner() {
  const env = getCurrentEnvironment();
  
  if (env === 'production') {
    return null; // No banner in production
  }
  
  return {
    environment: env,
    message: env === 'development' 
      ? '🚧 Development Environment - Debug mode enabled'
      : '🧪 Staging Environment - Testing in progress',
    color: env === 'development' ? 'blue' : 'orange'
  };
}