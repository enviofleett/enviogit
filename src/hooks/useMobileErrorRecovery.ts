import { useState, useCallback, useRef } from 'react';
import { useToast } from './use-toast';

export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelays: number[];
  criticalErrors: string[];
  autoRetry: boolean;
}

export interface ErrorRecoveryState {
  isRecovering: boolean;
  lastError: string | null;
  errorCount: number;
  retryCount: number;
  lastRetryTime: number;
  canRetry: boolean;
}

const DEFAULT_CONFIG: ErrorRecoveryConfig = {
  maxRetries: 3,
  retryDelays: [1000, 3000, 5000],
  criticalErrors: ['Authentication', 'Token', 'Network', 'GPS51'],
  autoRetry: true
};

export function useMobileErrorRecovery(config: Partial<ErrorRecoveryConfig> = {}) {
  const { toast } = useToast();
  const [state, setState] = useState<ErrorRecoveryState>({
    isRecovering: false,
    lastError: null,
    errorCount: 0,
    retryCount: 0,
    lastRetryTime: 0,
    canRetry: true
  });

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const recoveryTimer = useRef<NodeJS.Timeout | null>(null);

  const classifyError = useCallback((error: Error): 'critical' | 'recoverable' | 'network' => {
    const message = error.message.toLowerCase();
    
    if (finalConfig.criticalErrors.some(critical => 
      message.includes(critical.toLowerCase())
    )) {
      return 'critical';
    }
    
    if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return 'network';
    }
    
    return 'recoverable';
  }, [finalConfig.criticalErrors]);

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string = 'Operation'
  ): Promise<T> => {
    setState(prev => ({ ...prev, isRecovering: true }));
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Success - reset error state
        setState(prev => ({
          ...prev,
          isRecovering: false,
          lastError: null,
          errorCount: 0,
          retryCount: 0,
          canRetry: true
        }));
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const errorType = classifyError(lastError);
        
        setState(prev => ({
          ...prev,
          lastError: lastError!.message,
          errorCount: prev.errorCount + 1,
          retryCount: attempt,
          lastRetryTime: Date.now()
        }));

        // Don't retry on critical errors
        if (errorType === 'critical') {
          toast({
            title: `${context} Failed`,
            description: `Critical error: ${lastError.message}`,
            variant: "destructive"
          });
          break;
        }

        // Last attempt - don't wait
        if (attempt === finalConfig.maxRetries) {
          break;
        }

        // Wait before retry
        const delay = finalConfig.retryDelays[attempt] || finalConfig.retryDelays[finalConfig.retryDelays.length - 1];
        
        toast({
          title: `${context} Failed`,
          description: `Retrying in ${delay/1000}s... (${attempt + 1}/${finalConfig.maxRetries})`,
          variant: "destructive"
        });

        await new Promise(resolve => {
          recoveryTimer.current = setTimeout(resolve, delay);
        });
      }
    }

    // All retries failed
    setState(prev => ({
      ...prev,
      isRecovering: false,
      canRetry: state.errorCount < 10 // Allow retry after some time
    }));

    toast({
      title: `${context} Failed`,
      description: `All retry attempts failed: ${lastError?.message}`,
      variant: "destructive"
    });

    throw lastError;
  }, [finalConfig, toast, state.errorCount, classifyError]);

  const clearErrors = useCallback(() => {
    setState({
      isRecovering: false,
      lastError: null,
      errorCount: 0,
      retryCount: 0,
      lastRetryTime: 0,
      canRetry: true
    });
    
    if (recoveryTimer.current) {
      clearTimeout(recoveryTimer.current);
      recoveryTimer.current = null;
    }
  }, []);

  const handleError = useCallback((error: Error, context: string = 'Operation') => {
    const errorType = classifyError(error);
    
    setState(prev => ({
      ...prev,
      lastError: error.message,
      errorCount: prev.errorCount + 1,
      canRetry: errorType !== 'critical'
    }));

    if (errorType === 'critical') {
      toast({
        title: `${context} Error`,
        description: `Critical: ${error.message}`,
        variant: "destructive"
      });
    } else if (finalConfig.autoRetry && state.canRetry) {
      toast({
        title: `${context} Error`,
        description: `Will retry automatically: ${error.message}`,
        variant: "destructive"
      });
    } else {
      toast({
        title: `${context} Error`,
        description: error.message,
        variant: "destructive"
      });
    }
  }, [classifyError, finalConfig.autoRetry, state.canRetry, toast]);

  return {
    state,
    executeWithRetry,
    handleError,
    clearErrors,
    canRetry: state.canRetry && !state.isRecovering
  };
}