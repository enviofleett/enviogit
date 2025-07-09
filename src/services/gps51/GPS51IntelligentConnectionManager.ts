import { GPS51AuthenticationService, GPS51AuthenticationResult } from './GPS51AuthenticationService';
import { GPS51ProxyClient } from './GPS51ProxyClient';
import { GPS51AuthCredentials } from './GPS51Types';

export interface ConnectionStrategy {
  name: 'proxy' | 'direct';
  priority: number;
  isAvailable: boolean;
  lastSuccess?: number;
  lastFailure?: number;
  responseTime?: number;
}

export interface ConnectionResult {
  success: boolean;
  strategy: 'proxy' | 'direct';
  error?: string;
  responseTime: number;
  token?: string;
  user?: any;
}

export class GPS51IntelligentConnectionManager {
  private static instance: GPS51IntelligentConnectionManager;
  private authService: GPS51AuthenticationService;
  private proxyClient: GPS51ProxyClient;
  private strategies: Map<string, ConnectionStrategy> = new Map();
  private fallbackOrder: string[] = ['proxy', 'direct'];

  constructor() {
    this.authService = GPS51AuthenticationService.getInstance();
    this.proxyClient = GPS51ProxyClient.getInstance();
    
    // Initialize connection strategies with proper availability
    this.strategies.set('proxy', {
      name: 'proxy',
      priority: 1,
      isAvailable: true // Proxy should always be available initially
    });
    
    this.strategies.set('direct', {
      name: 'direct',
      priority: 2,
      isAvailable: false // DISABLED: Direct connection causes CORS errors
    });
    
    console.log('GPS51IntelligentConnectionManager: Initialized with strategies:', 
      Array.from(this.strategies.entries()).map(([name, strategy]) => ({
        name,
        priority: strategy.priority,
        isAvailable: strategy.isAvailable
      }))
    );
  }

  static getInstance(): GPS51IntelligentConnectionManager {
    if (!GPS51IntelligentConnectionManager.instance) {
      GPS51IntelligentConnectionManager.instance = new GPS51IntelligentConnectionManager();
    }
    return GPS51IntelligentConnectionManager.instance;
  }

  /**
   * Intelligently connect using the best available strategy
   */
  async connectWithBestStrategy(credentials: GPS51AuthCredentials): Promise<ConnectionResult> {
    console.log('GPS51IntelligentConnectionManager: Starting intelligent connection...');
    
    // First, test connection health to update strategy availability
    console.log('GPS51IntelligentConnectionManager: Testing connection health before authentication...');
    await this.testAllConnections();
    
    // Sort strategies by priority and availability
    const availableStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.isAvailable)
      .sort((a, b) => a.priority - b.priority);

    console.log('GPS51IntelligentConnectionManager: Available connection strategies:', 
      availableStrategies.map(s => ({ name: s.name, priority: s.priority, isAvailable: s.isAvailable }))
    );

    let lastError: string = '';
    
    for (const strategy of availableStrategies) {
      try {
        console.log(`GPS51IntelligentConnectionManager: Attempting ${strategy.name} connection...`);
        
        const result = await this.attemptConnection(strategy.name, credentials);
        
        if (result.success) {
          this.recordSuccess(strategy.name, result.responseTime);
          console.log(`GPS51IntelligentConnectionManager: ${strategy.name} connection successful`);
          return result;
        } else {
          this.recordFailure(strategy.name);
          lastError = result.error || `${strategy.name} connection failed`;
        }
      } catch (error) {
        this.recordFailure(strategy.name);
        lastError = error instanceof Error ? error.message : `${strategy.name} connection error`;
        console.error(`GPS51IntelligentConnectionManager: ${strategy.name} strategy failed:`, error);
      }
    }

    // All strategies failed
    return {
      success: false,
      strategy: 'proxy', // Default fallback
      error: `All connection strategies failed. Last error: ${lastError}`,
      responseTime: 0
    };
  }

  /**
   * Attempt connection with specific strategy
   */
  private async attemptConnection(strategyName: 'proxy' | 'direct', credentials: GPS51AuthCredentials): Promise<ConnectionResult> {
    const startTime = Date.now();
    
    try {
      if (strategyName === 'proxy') {
        const authResult = await this.authService.authenticate(credentials);
        
        return {
          success: authResult.success,
          strategy: 'proxy',
          error: authResult.error,
          responseTime: Date.now() - startTime,
          token: authResult.token,
          user: authResult.user
        };
      } else {
        // DISABLED: Direct connection causes CORS "Failed to fetch" errors
        // All requests must go through proxy to avoid browser CORS restrictions
        return {
          success: false,
          strategy: 'direct',
          error: 'Direct connection disabled due to CORS restrictions. Use proxy connection.',
          responseTime: Date.now() - startTime
        };
      }
    } catch (error) {
      return {
        success: false,
        strategy: strategyName,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Test connection health for all strategies
   */
  async testAllConnections(apiUrl?: string): Promise<Map<string, { success: boolean; responseTime: number; error?: string }>> {
    const results = new Map();
    
    console.log('GPS51IntelligentConnectionManager: Testing proxy connection...');
    
    // Test proxy connection
    try {
      const proxyResult = await this.proxyClient.testConnection(apiUrl);
      results.set('proxy', proxyResult);
      
      console.log('GPS51IntelligentConnectionManager: Proxy test result:', {
        success: proxyResult.success,
        responseTime: proxyResult.responseTime,
        error: proxyResult.error
      });
      
      // Update strategy availability - be more lenient for proxy availability
      const proxyStrategy = this.strategies.get('proxy');
      if (proxyStrategy) {
        // Consider proxy available even if test fails initially - Edge Function might be cold
        proxyStrategy.isAvailable = true; // Always keep proxy available
        proxyStrategy.responseTime = proxyResult.responseTime;
        if (!proxyResult.success) {
          console.warn('GPS51IntelligentConnectionManager: Proxy test failed but keeping proxy strategy available for cold starts');
        }
      }
    } catch (error) {
      console.error('GPS51IntelligentConnectionManager: Proxy connection test error:', error);
      results.set('proxy', {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Proxy test failed'
      });
      
      // Keep proxy available even on error - might be a cold start
      const proxyStrategy = this.strategies.get('proxy');
      if (proxyStrategy) {
        proxyStrategy.isAvailable = true;
        console.warn('GPS51IntelligentConnectionManager: Keeping proxy strategy available despite test error');
      }
    }

    // Test direct connection (placeholder for future CORS-free implementation)
    console.log('GPS51IntelligentConnectionManager: Direct connection not yet implemented due to CORS');
    results.set('direct', {
      success: false,
      responseTime: 0,
      error: 'Direct connection not available due to CORS restrictions'
    });

    console.log('GPS51IntelligentConnectionManager: Connection test completed:', {
      proxyAvailable: this.strategies.get('proxy')?.isAvailable,
      directAvailable: this.strategies.get('direct')?.isAvailable,
      totalStrategies: this.strategies.size
    });

    return results;
  }

  /**
   * Record successful connection
   */
  private recordSuccess(strategyName: string, responseTime: number): void {
    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      strategy.lastSuccess = Date.now();
      strategy.responseTime = responseTime;
      strategy.isAvailable = true;
      
      // Adjust priority based on performance
      if (responseTime < 1000 && strategy.priority > 1) {
        strategy.priority = Math.max(1, strategy.priority - 1);
      }
    }
  }

  /**
   * Record failed connection
   */
  private recordFailure(strategyName: string): void {
    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      strategy.lastFailure = Date.now();
      
      // Temporarily lower priority on failure
      strategy.priority = Math.min(10, strategy.priority + 1);
      
      // Mark as unavailable if multiple recent failures
      const recentFailures = this.getRecentFailureCount(strategyName);
      if (recentFailures >= 3) {
        strategy.isAvailable = false;
        console.warn(`GPS51IntelligentConnectionManager: ${strategyName} marked as unavailable due to repeated failures`);
      }
    }
  }

  /**
   * Get recent failure count for a strategy
   */
  private getRecentFailureCount(strategyName: string): number {
    const strategy = this.strategies.get(strategyName);
    if (!strategy || !strategy.lastFailure) {
      return 0;
    }
    
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return strategy.lastFailure > fiveMinutesAgo ? 1 : 0;
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(): {
    strategies: Array<{ name: string; available: boolean; priority: number; responseTime?: number }>;
    recommendedStrategy: string;
    overallHealth: 'good' | 'degraded' | 'poor';
  } {
    const strategies = Array.from(this.strategies.entries()).map(([name, strategy]) => ({
      name,
      available: strategy.isAvailable,
      priority: strategy.priority,
      responseTime: strategy.responseTime
    }));

    const availableCount = strategies.filter(s => s.available).length;
    const recommendedStrategy = strategies
      .filter(s => s.available)
      .sort((a, b) => a.priority - b.priority)[0]?.name || 'proxy';

    let overallHealth: 'good' | 'degraded' | 'poor';
    if (availableCount >= 2) {
      overallHealth = 'good';
    } else if (availableCount === 1) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'poor';
    }

    return {
      strategies,
      recommendedStrategy,
      overallHealth
    };
  }

  /**
   * Reset strategy health tracking
   */
  resetHealthTracking(): void {
    this.strategies.forEach(strategy => {
      strategy.lastSuccess = undefined;
      strategy.lastFailure = undefined;
      strategy.priority = strategy.name === 'proxy' ? 1 : 2;
      strategy.isAvailable = strategy.name === 'proxy'; // Proxy is always available by default
    });
    
    console.log('GPS51IntelligentConnectionManager: Health tracking reset');
  }
}

export const gps51IntelligentConnectionManager = GPS51IntelligentConnectionManager.getInstance();