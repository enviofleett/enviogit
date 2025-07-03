import { useState, useEffect, useCallback, useRef } from 'react';
import { useGPS51DirectAuth } from './useGPS51DirectAuth';
import { useGPS51DirectVehicles } from './useGPS51DirectVehicles';
import { useGPS51DirectPositions } from './useGPS51DirectPositions';
import { useToast } from './use-toast';

export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelays: number[]; // Progressive delays in ms
  criticalErrors: string[]; // Errors that require immediate attention
  recoveryStrategies: {
    auth: 'refresh' | 'reauth' | 'manual';
    network: 'retry' | 'fallback' | 'manual';
    api: 'retry' | 'degraded' | 'manual';
  };
  autoRecovery: boolean;
  notifyUser: boolean;
}

export interface RecoveryAttempt {
  timestamp: number;
  errorType: string;
  strategy: string;
  success: boolean;
  duration: number;
  retryCount: number;
}

export interface ErrorRecoveryState {
  isRecovering: boolean;
  lastError: string | null;
  errorCount: number;
  recoveryAttempts: RecoveryAttempt[];
  currentStrategy: string | null;
  degradedMode: boolean;
  recoverySuccess: boolean;
}

export interface UseGPS51ErrorRecoveryReturn {
  state: ErrorRecoveryState;
  attemptRecovery: (error: Error, context?: string) => Promise<boolean>;
  enableDegradedMode: () => void;
  disableDegradedMode: () => void;
  clearHistory: () => void;
  updateConfig: (config: Partial<ErrorRecoveryConfig>) => void;
  getRecoveryStats: () => {
    totalAttempts: number;
    successRate: number;
    averageDuration: number;
    commonErrors: Record<string, number>;
  };
}

const DEFAULT_CONFIG: ErrorRecoveryConfig = {
  maxRetries: 3,
  retryDelays: [1000, 3000, 5000], // 1s, 3s, 5s
  criticalErrors: [
    'Authentication failed',
    'Token expired',
    'Network timeout',
    'API rate limit exceeded'
  ],
  recoveryStrategies: {
    auth: 'refresh',
    network: 'retry',
    api: 'retry'
  },
  autoRecovery: true,
  notifyUser: true
};

export function useGPS51ErrorRecovery(
  initialConfig: Partial<ErrorRecoveryConfig> = {}
): UseGPS51ErrorRecoveryReturn {
  const { toast } = useToast();
  const [config, setConfig] = useState<ErrorRecoveryConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });

  const [state, setState] = useState<ErrorRecoveryState>({
    isRecovering: false,
    lastError: null,
    errorCount: 0,
    recoveryAttempts: [],
    currentStrategy: null,
    degradedMode: false,
    recoverySuccess: false
  });

  const auth = useGPS51DirectAuth();
  const vehicles = useGPS51DirectVehicles({ autoRefresh: false });
  const positions = useGPS51DirectPositions({ autoStart: false });

  const recoveryTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current);
      }
    };
  }, []);

  // Classify error type
  const classifyError = useCallback((error: Error): 'auth' | 'network' | 'api' | 'unknown' => {
    const message = error.message.toLowerCase();
    
    if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
      return 'auth';
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('api') || message.includes('rate limit') || message.includes('server')) {
      return 'api';
    }
    
    return 'unknown';
  }, []);

  // Check if error is critical
  const isCriticalError = useCallback((error: Error): boolean => {
    return config.criticalErrors.some(criticalError => 
      error.message.toLowerCase().includes(criticalError.toLowerCase())
    );
  }, [config.criticalErrors]);

  // Execute recovery strategy
  const executeRecoveryStrategy = useCallback(async (
    errorType: 'auth' | 'network' | 'api' | 'unknown',
    error: Error,
    retryCount: number
  ): Promise<boolean> => {
    const strategy = config.recoveryStrategies[errorType] || 'retry';
    const startTime = Date.now();

    console.log('GPS51 Error Recovery: Executing strategy', {
      errorType,
      strategy,
      retryCount,
      error: error.message
    });

    setState(prev => ({ 
      ...prev, 
      currentStrategy: strategy,
      isRecovering: true 
    }));

    try {
      switch (strategy) {
        case 'refresh':
          if (errorType === 'auth') {
            const refreshSuccess = await auth.actions.refreshToken();
            if (refreshSuccess) {
              return true;
            } else {
              // If refresh fails, try full re-auth
              return false; // Will trigger manual intervention
            }
          }
          break;

        case 'reauth':
          if (errorType === 'auth') {
            // Clear current auth and require manual re-authentication
            auth.actions.logout();
            return false; // Requires manual intervention
          }
          break;

        case 'retry':
          // Wait for progressive delay then return false to trigger retry
          if (retryCount < config.retryDelays.length) {
            const delay = config.retryDelays[retryCount];
            await new Promise(resolve => setTimeout(resolve, delay));
            return false; // Will be retried by caller
          }
          break;

        case 'fallback':
          // Enable degraded mode
          setState(prev => ({ ...prev, degradedMode: true }));
          if (config.notifyUser) {
            toast({
              title: "Degraded Mode",
              description: "Some features may be limited due to connectivity issues",
              variant: "destructive",
            });
          }
          return true; // Recovery "succeeded" by degrading

        case 'degraded':
          setState(prev => ({ ...prev, degradedMode: true }));
          return true;

        case 'manual':
          // Requires manual intervention
          if (config.notifyUser) {
            toast({
              title: "Manual Intervention Required",
              description: `${errorType} error: ${error.message}`,
              variant: "destructive",
            });
          }
          return false;

        default:
          return false;
      }

      return false;
    } catch (recoveryError) {
      console.error('GPS51 Error Recovery: Strategy failed:', recoveryError);
      return false;
    } finally {
      const duration = Date.now() - startTime;
      
      // Record recovery attempt
      const attempt: RecoveryAttempt = {
        timestamp: Date.now(),
        errorType,
        strategy,
        success: false, // Will be updated by caller
        duration,
        retryCount
      };

      setState(prev => ({
        ...prev,
        recoveryAttempts: [...prev.recoveryAttempts.slice(-49), attempt], // Keep last 50
        currentStrategy: null,
        isRecovering: false
      }));
    }
  }, [config, auth.actions, toast]);

  // Main recovery function
  const attemptRecovery = useCallback(async (
    error: Error, 
    context = 'unknown'
  ): Promise<boolean> => {
    if (state.isRecovering) {
      console.warn('GPS51 Error Recovery: Recovery already in progress');
      return false;
    }

    const errorType = classifyError(error);
    const isCritical = isCriticalError(error);

    console.log('GPS51 Error Recovery: Attempting recovery', {
      error: error.message,
      context,
      errorType,
      isCritical,
      autoRecovery: config.autoRecovery
    });

    setState(prev => ({
      ...prev,
      lastError: error.message,
      errorCount: prev.errorCount + 1,
      recoverySuccess: false
    }));

    // If auto-recovery is disabled and error is not critical, don't attempt recovery
    if (!config.autoRecovery && !isCritical) {
      if (config.notifyUser) {
        toast({
          title: "Error Occurred",
          description: error.message,
          variant: "destructive",
        });
      }
      return false;
    }

    // Attempt recovery with retries
    for (let retryCount = 0; retryCount < config.maxRetries; retryCount++) {
      try {
        const success = await executeRecoveryStrategy(errorType, error, retryCount);
        
        if (success) {
          setState(prev => ({
            ...prev,
            recoverySuccess: true,
            isRecovering: false
          }));

          // Update the last recovery attempt as successful
          setState(prev => ({
            ...prev,
            recoveryAttempts: prev.recoveryAttempts.map((attempt, index) => 
              index === prev.recoveryAttempts.length - 1 
                ? { ...attempt, success: true }
                : attempt
            )
          }));

          if (config.notifyUser) {
            toast({
              title: "Recovery Successful",
              description: `Recovered from ${errorType} error`,
            });
          }

          console.log('GPS51 Error Recovery: Recovery successful after', retryCount + 1, 'attempts');
          return true;
        }

        // If strategy was 'retry', continue to next retry
        const strategy = config.recoveryStrategies[errorType];
        if (strategy !== 'retry') {
          break; // Don't retry for non-retry strategies
        }

      } catch (recoveryError) {
        console.error('GPS51 Error Recovery: Recovery attempt failed:', recoveryError);
      }
    }

    // All recovery attempts failed
    setState(prev => ({
      ...prev,
      isRecovering: false,
      recoverySuccess: false
    }));

    if (config.notifyUser) {
      toast({
        title: "Recovery Failed",
        description: `Unable to recover from ${errorType} error. Manual intervention may be required.`,
        variant: "destructive",
      });
    }

    console.error('GPS51 Error Recovery: All recovery attempts failed for', errorType, 'error');
    return false;
  }, [state.isRecovering, classifyError, isCriticalError, config, executeRecoveryStrategy, toast]);

  // Enable degraded mode manually
  const enableDegradedMode = useCallback(() => {
    setState(prev => ({ ...prev, degradedMode: true }));
    
    if (config.notifyUser) {
      toast({
        title: "Degraded Mode Enabled",
        description: "Operating with limited functionality",
        variant: "destructive",
      });
    }
  }, [config.notifyUser, toast]);

  // Disable degraded mode manually
  const disableDegradedMode = useCallback(() => {
    setState(prev => ({ ...prev, degradedMode: false }));
    
    if (config.notifyUser) {
      toast({
        title: "Normal Mode Restored",
        description: "Full functionality restored",
      });
    }
  }, [config.notifyUser, toast]);

  // Clear recovery history
  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      recoveryAttempts: [],
      errorCount: 0,
      lastError: null
    }));
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ErrorRecoveryConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    console.log('GPS51 Error Recovery: Config updated', newConfig);
  }, []);

  // Get recovery statistics
  const getRecoveryStats = useCallback(() => {
    const attempts = state.recoveryAttempts;
    const totalAttempts = attempts.length;
    const successfulAttempts = attempts.filter(a => a.success).length;
    
    const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0;
    
    const averageDuration = totalAttempts > 0 
      ? attempts.reduce((sum, a) => sum + a.duration, 0) / totalAttempts 
      : 0;

    const commonErrors: Record<string, number> = {};
    attempts.forEach(attempt => {
      commonErrors[attempt.errorType] = (commonErrors[attempt.errorType] || 0) + 1;
    });

    return {
      totalAttempts,
      successRate: Math.round(successRate * 100) / 100,
      averageDuration: Math.round(averageDuration),
      commonErrors
    };
  }, [state.recoveryAttempts]);

  return {
    state,
    attemptRecovery,
    enableDegradedMode,
    disableDegradedMode,
    clearHistory,
    updateConfig,
    getRecoveryStats
  };
}