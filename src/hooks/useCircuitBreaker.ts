import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from './use-toast';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
  totalCalls: number;
  nextAttemptTime: number;
}

export interface CircuitBreakerMetrics {
  successRate: number;
  failureRate: number;
  averageResponseTime: number;
  isHealthy: boolean;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
  monitoringPeriod: 300000, // 5 minutes
  halfOpenMaxCalls: 3
};

export function useCircuitBreaker(
  name: string,
  config: Partial<CircuitBreakerConfig> = {}
) {
  const { toast } = useToast();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<CircuitBreakerState>({
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: 0,
    successCount: 0,
    totalCalls: 0,
    nextAttemptTime: 0
  });

  const responseTimeHistory = useRef<number[]>([]);
  const monitoringInterval = useRef<NodeJS.Timeout | null>(null);

  // Reset failure count periodically
  useEffect(() => {
    monitoringInterval.current = setInterval(() => {
      setState(prev => {
        const now = Date.now();
        const timeSinceLastFailure = now - prev.lastFailureTime;
        
        // Reset failure count if no failures in monitoring period
        if (timeSinceLastFailure > finalConfig.monitoringPeriod) {
          return {
            ...prev,
            failureCount: 0,
            successCount: 0,
            totalCalls: 0
          };
        }
        
        return prev;
      });
    }, finalConfig.monitoringPeriod);

    return () => {
      if (monitoringInterval.current) {
        clearInterval(monitoringInterval.current);
      }
    };
  }, [finalConfig.monitoringPeriod]);

  const canExecute = useCallback((): boolean => {
    const now = Date.now();

    switch (state.state) {
      case 'CLOSED':
        return true;
        
      case 'OPEN':
        if (now >= state.nextAttemptTime) {
          setState(prev => ({
            ...prev,
            state: 'HALF_OPEN',
            successCount: 0
          }));
          return true;
        }
        return false;
        
      case 'HALF_OPEN':
        return state.successCount < finalConfig.halfOpenMaxCalls;
        
      default:
        return false;
    }
  }, [state, finalConfig.halfOpenMaxCalls]);

  const recordSuccess = useCallback((responseTime: number) => {
    // Track response time
    responseTimeHistory.current.push(responseTime);
    if (responseTimeHistory.current.length > 100) {
      responseTimeHistory.current.shift();
    }

    setState(prev => {
      const newState = {
        ...prev,
        successCount: prev.successCount + 1,
        totalCalls: prev.totalCalls + 1
      };

      // Transition from HALF_OPEN to CLOSED after successful calls
      if (prev.state === 'HALF_OPEN' && newState.successCount >= finalConfig.halfOpenMaxCalls) {
        return {
          ...newState,
          state: 'CLOSED' as const,
          failureCount: 0
        };
      }

      return newState;
    });
  }, [finalConfig.halfOpenMaxCalls]);

  const recordFailure = useCallback((error: Error) => {
    const now = Date.now();

    setState(prev => {
      const newFailureCount = prev.failureCount + 1;
      const newState = {
        ...prev,
        failureCount: newFailureCount,
        lastFailureTime: now,
        totalCalls: prev.totalCalls + 1
      };

      // Open circuit if failure threshold exceeded
      if (newFailureCount >= finalConfig.failureThreshold) {
        toast({
          title: `Circuit Breaker: ${name}`,
          description: `Service temporarily unavailable due to repeated failures. Will retry in ${finalConfig.recoveryTimeout / 1000}s.`,
          variant: "destructive"
        });

        return {
          ...newState,
          state: 'OPEN' as const,
          nextAttemptTime: now + finalConfig.recoveryTimeout
        };
      }

      // Return to OPEN state from HALF_OPEN on failure
      if (prev.state === 'HALF_OPEN') {
        return {
          ...newState,
          state: 'OPEN' as const,
          nextAttemptTime: now + finalConfig.recoveryTimeout
        };
      }

      return newState;
    });
  }, [finalConfig.failureThreshold, finalConfig.recoveryTimeout, name, toast]);

  const execute = useCallback(async <T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> => {
    if (!canExecute()) {
      if (fallback) {
        console.log(`Circuit breaker ${name} OPEN - using fallback`);
        const fallbackResult = await fallback();
        return fallbackResult;
      } else {
        throw new Error(`Circuit breaker ${name} is OPEN - service temporarily unavailable`);
      }
    }

    const startTime = Date.now();
    
    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      recordSuccess(responseTime);
      return result;
    } catch (error) {
      recordFailure(error as Error);
      
      if (fallback) {
        console.log(`Operation failed, using fallback for ${name}:`, error);
        const fallbackResult = await fallback();
        return fallbackResult;
      } else {
        throw error;
      }
    }
  }, [canExecute, name, recordSuccess, recordFailure]);

  const getMetrics = useCallback((): CircuitBreakerMetrics => {
    const successRate = state.totalCalls > 0 ? 
      ((state.totalCalls - state.failureCount) / state.totalCalls) * 100 : 100;
    
    const failureRate = 100 - successRate;
    
    const averageResponseTime = responseTimeHistory.current.length > 0 ?
      responseTimeHistory.current.reduce((sum, time) => sum + time, 0) / responseTimeHistory.current.length : 0;
    
    const isHealthy = state.state === 'CLOSED' && successRate > 80;

    return {
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      isHealthy
    };
  }, [state]);

  const reset = useCallback(() => {
    setState({
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
      totalCalls: 0,
      nextAttemptTime: 0
    });
    responseTimeHistory.current = [];
    
    toast({
      title: `Circuit Breaker: ${name}`,
      description: "Circuit breaker has been reset",
    });
  }, [name, toast]);

  const getStatus = useCallback(() => {
    return {
      name,
      ...state,
      canExecute: canExecute(),
      metrics: getMetrics(),
      timeUntilRetry: state.state === 'OPEN' ? 
        Math.max(0, state.nextAttemptTime - Date.now()) : 0
    };
  }, [name, state, canExecute, getMetrics]);

  return {
    execute,
    getStatus,
    getMetrics,
    reset,
    canExecute,
    state: state.state,
    isHealthy: getMetrics().isHealthy
  };
}