import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from './use-toast';
import { useCircuitBreaker } from './useCircuitBreaker';
import { useRetryMechanism } from './useRetryMechanism';

export interface DegradationLevel {
  level: 'full' | 'limited' | 'offline' | 'emergency';
  features: string[];
  limitations: string[];
  message: string;
}

export interface DegradationState {
  currentLevel: DegradationLevel;
  availableFeatures: Set<string>;
  disabledFeatures: Set<string>;
  lastHealthCheck: number;
  healthScore: number;
  isRecovering: boolean;
}

export interface ServiceHealth {
  gps51: boolean;
  database: boolean;
  authentication: boolean;
  realtime: boolean;
}

const DEGRADATION_LEVELS: Record<string, DegradationLevel> = {
  full: {
    level: 'full',
    features: ['tracking', 'controls', 'alerts', 'reports', 'realtime'],
    limitations: [],
    message: 'All systems operational'
  },
  limited: {
    level: 'limited',
    features: ['tracking', 'controls', 'alerts'],
    limitations: ['No real-time updates', 'Limited reporting'],
    message: 'Operating with limited functionality'
  },
  offline: {
    level: 'offline',
    features: ['cached_data', 'basic_controls'],
    limitations: ['No live tracking', 'No new data', 'Limited vehicle controls'],
    message: 'Operating in offline mode with cached data'
  },
  emergency: {
    level: 'emergency',
    features: ['emergency_contact', 'cached_locations'],
    limitations: ['No vehicle controls', 'No live data', 'Emergency features only'],
    message: 'Emergency mode - limited functionality available'
  }
};

export function useGracefulDegradation(serviceName: string = 'Fleet System') {
  const { toast } = useToast();
  
  const [state, setState] = useState<DegradationState>({
    currentLevel: DEGRADATION_LEVELS.full,
    availableFeatures: new Set(DEGRADATION_LEVELS.full.features),
    disabledFeatures: new Set(),
    lastHealthCheck: Date.now(),
    healthScore: 100,
    isRecovering: false
  });

  const cachedData = useRef<Map<string, any>>(new Map());
  const fallbackData = useRef<Map<string, any>>(new Map());
  const healthHistory = useRef<number[]>([]);

  // Circuit breakers for different services
  const gps51CircuitBreaker = useCircuitBreaker('GPS51', {
    failureThreshold: 3,
    recoveryTimeout: 30000
  });

  const databaseCircuitBreaker = useCircuitBreaker('Database', {
    failureThreshold: 5,
    recoveryTimeout: 15000
  });

  const realtimeCircuitBreaker = useCircuitBreaker('Realtime', {
    failureThreshold: 2,
    recoveryTimeout: 45000
  });

  // Retry mechanisms
  const dataRetry = useRetryMechanism('Data Fetch', {
    maxRetries: 2,
    baseDelay: 1000,
    backoffMultiplier: 1.5
  });

  const controlRetry = useRetryMechanism('Vehicle Control', {
    maxRetries: 3,
    baseDelay: 2000,
    backoffMultiplier: 2
  });

  // Calculate health score based on service availability
  const calculateHealthScore = useCallback((services: ServiceHealth): number => {
    const weights = {
      gps51: 40,
      database: 30,
      authentication: 20,
      realtime: 10
    };

    let score = 0;
    Object.entries(services).forEach(([service, isHealthy]) => {
      if (isHealthy) {
        score += weights[service as keyof typeof weights];
      }
    });

    return score;
  }, []);

  // Determine appropriate degradation level
  const determineDegradationLevel = useCallback((healthScore: number, services: ServiceHealth): DegradationLevel => {
    if (!services.authentication) {
      return DEGRADATION_LEVELS.emergency;
    }

    if (healthScore >= 80) {
      return DEGRADATION_LEVELS.full;
    } else if (healthScore >= 50) {
      return DEGRADATION_LEVELS.limited;
    } else if (healthScore >= 20) {
      return DEGRADATION_LEVELS.offline;
    } else {
      return DEGRADATION_LEVELS.emergency;
    }
  }, []);

  // Check service health
  const checkServiceHealth = useCallback(async (): Promise<ServiceHealth> => {
    const services: ServiceHealth = {
      gps51: gps51CircuitBreaker.isHealthy,
      database: databaseCircuitBreaker.isHealthy,
      authentication: true, // Assume auth is healthy if we can check
      realtime: realtimeCircuitBreaker.isHealthy
    };

    // Test actual service availability
    try {
      // Test database connectivity (simplified)
      if (databaseCircuitBreaker.canExecute) {
        // Database health check would go here
        services.database = true;
      }
    } catch (error) {
      services.database = false;
    }

    return services;
  }, [gps51CircuitBreaker, databaseCircuitBreaker, realtimeCircuitBreaker]);

  // Update degradation state
  const updateDegradationState = useCallback(async () => {
    const services = await checkServiceHealth();
    const healthScore = calculateHealthScore(services);
    const newLevel = determineDegradationLevel(healthScore, services);

    // Update health history
    healthHistory.current.push(healthScore);
    if (healthHistory.current.length > 20) {
      healthHistory.current.shift();
    }

    setState(prev => {
      const levelChanged = prev.currentLevel.level !== newLevel.level;
      
      if (levelChanged) {
        // Notify user of degradation level change
        const isUpgrade = ['emergency', 'offline', 'limited', 'full'].indexOf(newLevel.level) >
                         ['emergency', 'offline', 'limited', 'full'].indexOf(prev.currentLevel.level);
        
        toast({
          title: `${serviceName} Status Update`,
          description: newLevel.message,
          variant: isUpgrade ? 'default' : 'destructive'
        });
      }

      return {
        ...prev,
        currentLevel: newLevel,
        availableFeatures: new Set(newLevel.features),
        disabledFeatures: new Set(
          Object.values(DEGRADATION_LEVELS)
            .flatMap(level => level.features)
            .filter(feature => !newLevel.features.includes(feature))
        ),
        lastHealthCheck: Date.now(),
        healthScore
      };
    });
  }, [checkServiceHealth, calculateHealthScore, determineDegradationLevel, serviceName, toast]);

  // Execute operation with degradation awareness
  const executeWithDegradation = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      feature: string;
      fallback?: () => Promise<T> | T;
      cacheKey?: string;
      useRetry?: boolean;
      circuitBreaker?: 'gps51' | 'database' | 'realtime';
    }
  ): Promise<T> => {
    const { feature, fallback, cacheKey, useRetry = true, circuitBreaker } = options;

    // Check if feature is available at current degradation level
    if (!state.availableFeatures.has(feature)) {
      if (fallback) {
        console.log(`Feature ${feature} not available, using fallback`);
        const result = await fallback();
        return result;
      } else {
        throw new Error(`Feature ${feature} is not available in ${state.currentLevel.level} mode`);
      }
    }

    // Select appropriate circuit breaker
    let selectedCircuitBreaker = gps51CircuitBreaker;
    if (circuitBreaker === 'database') {
      selectedCircuitBreaker = databaseCircuitBreaker;
    } else if (circuitBreaker === 'realtime') {
      selectedCircuitBreaker = realtimeCircuitBreaker;
    }

    // Execute with circuit breaker and retry
    const executeOperation = async (): Promise<T> => {
      return selectedCircuitBreaker.execute(
        useRetry ? 
          () => dataRetry.executeWithRetry(operation) :
          operation,
        fallback
      );
    };

    try {
      const result = await executeOperation();
      
      // Cache successful results
      if (cacheKey) {
        cachedData.current.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          feature
        });
      }
      
      return result;
    } catch (error) {
      console.error(`Operation failed for feature ${feature}:`, error);
      
      // Try to use cached data
      if (cacheKey && cachedData.current.has(cacheKey)) {
        const cached = cachedData.current.get(cacheKey);
        const cacheAge = Date.now() - cached.timestamp;
        
        // Use cache if less than 5 minutes old
        if (cacheAge < 300000) {
          toast({
            title: "Using Cached Data",
            description: `Live data unavailable, showing cached ${feature} data`,
            variant: "destructive"
          });
          return cached.data;
        }
      }
      
      // Try fallback data
      if (fallbackData.current.has(feature)) {
        toast({
          title: "Using Fallback Data",
          description: `Live data unavailable, showing fallback ${feature} data`,
          variant: "destructive"
        });
        return fallbackData.current.get(feature);
      }
      
      throw error;
    }
  }, [state, gps51CircuitBreaker, databaseCircuitBreaker, realtimeCircuitBreaker, dataRetry, toast]);

  // Store fallback data
  const setFallbackData = useCallback((feature: string, data: any) => {
    fallbackData.current.set(feature, data);
  }, []);

  // Get cached data
  const getCachedData = useCallback((cacheKey: string) => {
    return cachedData.current.get(cacheKey);
  }, []);

  // Force recovery attempt
  const attemptRecovery = useCallback(async () => {
    setState(prev => ({ ...prev, isRecovering: true }));
    
    try {
      // Reset circuit breakers
      gps51CircuitBreaker.reset();
      databaseCircuitBreaker.reset();
      realtimeCircuitBreaker.reset();
      
      // Check health
      await updateDegradationState();
      
      toast({
        title: `${serviceName} Recovery`,
        description: "Attempting to restore full functionality..."
      });
    } finally {
      setState(prev => ({ ...prev, isRecovering: false }));
    }
  }, [gps51CircuitBreaker, databaseCircuitBreaker, realtimeCircuitBreaker, updateDegradationState, serviceName, toast]);

  // Auto-recovery check
  useEffect(() => {
    const interval = setInterval(updateDegradationState, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [updateDegradationState]);

  // Initial health check
  useEffect(() => {
    updateDegradationState();
  }, [updateDegradationState]);

  return {
    state,
    executeWithDegradation,
    setFallbackData,
    getCachedData,
    attemptRecovery,
    updateDegradationState,
    
    // Feature availability checks
    isFeatureAvailable: (feature: string) => state.availableFeatures.has(feature),
    getAvailableFeatures: () => Array.from(state.availableFeatures),
    getDisabledFeatures: () => Array.from(state.disabledFeatures),
    
    // Metrics
    getHealthScore: () => state.healthScore,
    getHealthTrend: () => {
      if (healthHistory.current.length < 2) return 'stable';
      const recent = healthHistory.current.slice(-5);
      const average = recent.reduce((sum, score) => sum + score, 0) / recent.length;
      const previous = healthHistory.current.slice(-10, -5);
      const previousAverage = previous.reduce((sum, score) => sum + score, 0) / previous.length;
      
      if (average > previousAverage + 10) return 'improving';
      if (average < previousAverage - 10) return 'degrading';
      return 'stable';
    },
    
    // Circuit breaker status
    getCircuitBreakerStatus: () => ({
      gps51: gps51CircuitBreaker.getStatus(),
      database: databaseCircuitBreaker.getStatus(),
      realtime: realtimeCircuitBreaker.getStatus()
    })
  };
}