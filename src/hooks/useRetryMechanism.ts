import { useState, useCallback, useRef } from 'react';
import { useToast } from './use-toast';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: Error) => boolean;
}

export interface RetryState {
  attempt: number;
  isRetrying: boolean;
  lastError: Error | null;
  totalDelay: number;
  nextRetryTime: number;
}

export interface RetryMetrics {
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryDelay: number;
  successRate: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx errors
    const message = error.message.toLowerCase();
    return message.includes('network') || 
           message.includes('timeout') || 
           message.includes('fetch') ||
           message.includes('50'); // 500, 502, 503, etc.
  }
};

export function useRetryMechanism(
  operationName: string,
  config: Partial<RetryConfig> = {}
) {
  const { toast } = useToast();
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<RetryState>({
    attempt: 0,
    isRetrying: false,
    lastError: null,
    totalDelay: 0,
    nextRetryTime: 0
  });

  const metrics = useRef<RetryMetrics>({
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageRetryDelay: 0,
    successRate: 0
  });

  const retryTimeouts = useRef<Set<NodeJS.Timeout>>(new Set());

  const calculateDelay = useCallback((attemptNumber: number): number => {
    let delay = finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attemptNumber - 1);
    
    // Apply maximum delay cap
    delay = Math.min(delay, finalConfig.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (finalConfig.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(delay, 0);
  }, [finalConfig]);

  const shouldRetry = useCallback((error: Error, attemptNumber: number): boolean => {
    if (attemptNumber >= finalConfig.maxRetries) {
      return false;
    }
    
    if (finalConfig.retryCondition) {
      return finalConfig.retryCondition(error);
    }
    
    return true;
  }, [finalConfig]);

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, delay: number, error: Error) => void
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
      try {
        setState(prev => ({
          ...prev,
          attempt,
          isRetrying: attempt > 1,
          lastError: null
        }));

        const result = await operation();
        
        // Success - update metrics
        if (attempt > 1) {
          metrics.current.successfulRetries++;
          toast({
            title: `${operationName} Recovered`,
            description: `Operation succeeded after ${attempt - 1} retries`
          });
        }
        
        setState(prev => ({
          ...prev,
          isRetrying: false,
          attempt: 0
        }));
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        metrics.current.totalAttempts++;
        
        setState(prev => ({
          ...prev,
          lastError
        }));

        // Check if we should retry
        if (!shouldRetry(lastError, attempt)) {
          setState(prev => ({
            ...prev,
            isRetrying: false
          }));
          
          if (attempt > finalConfig.maxRetries) {
            metrics.current.failedRetries++;
            toast({
              title: `${operationName} Failed`,
              description: `Operation failed after ${finalConfig.maxRetries} retries: ${lastError.message}`,
              variant: "destructive"
            });
          }
          
          throw lastError;
        }

        // Calculate delay for next attempt
        const delay = calculateDelay(attempt);
        const nextRetryTime = Date.now() + delay;
        
        setState(prev => ({
          ...prev,
          totalDelay: prev.totalDelay + delay,
          nextRetryTime
        }));

        // Update average retry delay
        const totalDelays = metrics.current.successfulRetries + metrics.current.failedRetries;
        if (totalDelays > 0) {
          metrics.current.averageRetryDelay = 
            (metrics.current.averageRetryDelay * (totalDelays - 1) + delay) / totalDelays;
        } else {
          metrics.current.averageRetryDelay = delay;
        }

        // Notify about retry
        if (onRetry) {
          onRetry(attempt, delay, lastError);
        }

        toast({
          title: `${operationName} Retrying`,
          description: `Attempt ${attempt} failed. Retrying in ${(delay / 1000).toFixed(1)}s...`,
          variant: "destructive"
        });

        // Wait before retry
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, delay);
          retryTimeouts.current.add(timeout);
          
          // Clean up timeout reference when it completes
          setTimeout(() => {
            retryTimeouts.current.delete(timeout);
          }, delay + 100);
        });
      }
    }

    throw lastError!;
  }, [
    finalConfig,
    operationName,
    shouldRetry,
    calculateDelay,
    toast
  ]);

  const cancelRetries = useCallback(() => {
    // Cancel all pending timeouts
    retryTimeouts.current.forEach(timeout => {
      clearTimeout(timeout);
    });
    retryTimeouts.current.clear();
    
    setState(prev => ({
      ...prev,
      isRetrying: false,
      attempt: 0
    }));
    
    toast({
      title: `${operationName} Cancelled`,
      description: "Retry attempts have been cancelled"
    });
  }, [operationName, toast]);

  const getMetrics = useCallback((): RetryMetrics => {
    const totalRetries = metrics.current.successfulRetries + metrics.current.failedRetries;
    const successRate = totalRetries > 0 ? 
      (metrics.current.successfulRetries / totalRetries) * 100 : 0;

    return {
      ...metrics.current,
      successRate: Math.round(successRate * 100) / 100
    };
  }, []);

  const resetMetrics = useCallback(() => {
    metrics.current = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageRetryDelay: 0,
      successRate: 0
    };
  }, []);

  const getTimeUntilNextRetry = useCallback((): number => {
    if (!state.isRetrying || state.nextRetryTime === 0) {
      return 0;
    }
    return Math.max(0, state.nextRetryTime - Date.now());
  }, [state]);

  return {
    executeWithRetry,
    cancelRetries,
    getMetrics,
    resetMetrics,
    getTimeUntilNextRetry,
    state,
    isRetrying: state.isRetrying,
    currentAttempt: state.attempt,
    lastError: state.lastError
  };
}