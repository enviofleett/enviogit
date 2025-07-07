import { supabase } from '@/integrations/supabase/client';
import { GPS51RateLimitError } from './GPS51RateLimitError';

export interface GPS51Error {
  id: string;
  type: 'authentication' | 'rate_limit' | 'network' | 'circuit_breaker' | 'api' | 'unknown';
  message: string;
  originalError: Error;
  timestamp: number;
  context?: Record<string, any>;
  recoverable: boolean;
  retryable: boolean;
}

export interface GPS51ErrorRecoveryStrategy {
  canRecover: (error: GPS51Error) => boolean;
  recover: (error: GPS51Error) => Promise<boolean>;
  getRetryDelay: (attemptCount: number) => number;
}

class GPS51CentralizedErrorHandler {
  private static instance: GPS51CentralizedErrorHandler;
  private errorHistory: GPS51Error[] = [];
  private recoveryStrategies: GPS51ErrorRecoveryStrategy[] = [];
  private errorCallbacks: Set<(error: GPS51Error) => void> = new Set();
  private readonly MAX_ERROR_HISTORY = 100;

  static getInstance(): GPS51CentralizedErrorHandler {
    if (!GPS51CentralizedErrorHandler.instance) {
      GPS51CentralizedErrorHandler.instance = new GPS51CentralizedErrorHandler();
    }
    return GPS51CentralizedErrorHandler.instance;
  }

  constructor() {
    this.initializeDefaultRecoveryStrategies();
  }

  private initializeDefaultRecoveryStrategies(): void {
    // Rate limiting recovery
    this.addRecoveryStrategy({
      canRecover: (error) => error.type === 'rate_limit',
      recover: async (error) => {
        const rateLimitError = error.originalError as GPS51RateLimitError;
        const waitTime = rateLimitError.retryAfter || 60000; // Default 1 minute
        
        console.log(`GPS51ErrorHandler: Rate limit recovery - waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return true;
      },
      getRetryDelay: (attemptCount) => Math.min(60000 * Math.pow(2, attemptCount), 300000) // Max 5 minutes
    });

    // Circuit breaker recovery
    this.addRecoveryStrategy({
      canRecover: (error) => error.type === 'circuit_breaker',
      recover: async (error) => {
        console.log('GPS51ErrorHandler: Circuit breaker recovery - waiting for reset');
        await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
        return true;
      },
      getRetryDelay: (attemptCount) => 300000 // Always 5 minutes for circuit breaker
    });

    // Network error recovery
    this.addRecoveryStrategy({
      canRecover: (error) => error.type === 'network',
      recover: async (error) => {
        console.log('GPS51ErrorHandler: Network error recovery - exponential backoff');
        return true;
      },
      getRetryDelay: (attemptCount) => Math.min(2000 * Math.pow(2, attemptCount), 60000) // Max 1 minute
    });
  }

  public handleError(
    error: Error, 
    context?: Record<string, any>
  ): GPS51Error {
    const gps51Error = this.categorizeError(error, context);
    
    // Add to history
    this.errorHistory.push(gps51Error);
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory.shift();
    }

    // Log to database
    this.logError(gps51Error);

    // Notify callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(gps51Error);
      } catch (callbackError) {
        console.warn('GPS51ErrorHandler: Error callback failed:', callbackError);
      }
    });

    console.error('GPS51ErrorHandler: Error handled:', {
      type: gps51Error.type,
      message: gps51Error.message,
      recoverable: gps51Error.recoverable,
      context: gps51Error.context
    });

    return gps51Error;
  }

  private categorizeError(error: Error, context?: Record<string, any>): GPS51Error {
    const id = `gps51_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    
    let type: GPS51Error['type'] = 'unknown';
    let recoverable = false;
    let retryable = false;

    const message = error.message.toLowerCase();

    // Rate limiting errors
    if (error instanceof GPS51RateLimitError || message.includes('8902') || message.includes('rate limit')) {
      type = 'rate_limit';
      recoverable = true;
      retryable = true;
    }
    // Authentication errors
    else if (message.includes('authentication') || message.includes('unauthorized') || message.includes('401')) {
      type = 'authentication';
      recoverable = true;
      retryable = false;
    }
    // Circuit breaker errors
    else if (message.includes('circuit breaker') || message.includes('service unavailable')) {
      type = 'circuit_breaker';
      recoverable = true;
      retryable = true;
    }
    // Network errors
    else if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      type = 'network';
      recoverable = true;
      retryable = true;
    }
    // API errors
    else if (message.includes('api') || message.includes('http')) {
      type = 'api';
      recoverable = true;
      retryable = true;
    }

    return {
      id,
      type,
      message: error.message,
      originalError: error,
      timestamp,
      context,
      recoverable,
      retryable
    };
  }

  public async attemptRecovery(error: GPS51Error, attemptCount: number = 0): Promise<boolean> {
    if (!error.recoverable) {
      console.log('GPS51ErrorHandler: Error not recoverable:', error.type);
      return false;
    }

    const strategy = this.recoveryStrategies.find(s => s.canRecover(error));
    if (!strategy) {
      console.log('GPS51ErrorHandler: No recovery strategy found for:', error.type);
      return false;
    }

    try {
      console.log(`GPS51ErrorHandler: Attempting recovery for ${error.type} (attempt ${attemptCount + 1})`);
      
      // Wait for recovery delay if not first attempt
      if (attemptCount > 0) {
        const delay = strategy.getRetryDelay(attemptCount);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const recovered = await strategy.recover(error);
      
      if (recovered) {
        console.log(`GPS51ErrorHandler: Recovery successful for ${error.type}`);
        await this.logRecovery(error, attemptCount + 1);
      }
      
      return recovered;
    } catch (recoveryError) {
      console.error('GPS51ErrorHandler: Recovery failed:', recoveryError);
      return false;
    }
  }

  public addRecoveryStrategy(strategy: GPS51ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  public onError(callback: (error: GPS51Error) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  public getErrorHistory(type?: GPS51Error['type']): GPS51Error[] {
    if (type) {
      return this.errorHistory.filter(error => error.type === type);
    }
    return [...this.errorHistory];
  }

  public getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    recentErrors: number;
    recoveryRate: number;
  } {
    const total = this.errorHistory.length;
    const byType: Record<string, number> = {};
    
    this.errorHistory.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
    });

    const lastHour = Date.now() - (60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(error => error.timestamp > lastHour).length;
    
    const recoverableErrors = this.errorHistory.filter(error => error.recoverable).length;
    const recoveryRate = total > 0 ? (recoverableErrors / total) * 100 : 0;

    return {
      total,
      byType,
      recentErrors,
      recoveryRate
    };
  }

  private async logError(error: GPS51Error): Promise<void> {
    try {
      await supabase.from('api_calls_monitor').insert({
        endpoint: 'GPS51-ErrorHandler',
        method: 'ERROR',
        request_payload: {
          errorId: error.id,
          errorType: error.type,
          context: error.context
        },
        response_status: 0,
        response_body: {
          message: error.message,
          recoverable: error.recoverable,
          retryable: error.retryable
        },
        duration_ms: 0,
        error_message: error.message,
        timestamp: new Date(error.timestamp).toISOString()
      });
    } catch (logError) {
      console.warn('GPS51ErrorHandler: Failed to log error:', logError);
    }
  }

  private async logRecovery(error: GPS51Error, attemptCount: number): Promise<void> {
    try {
      await supabase.from('api_calls_monitor').insert({
        endpoint: 'GPS51-ErrorHandler-Recovery',
        method: 'RECOVERY',
        request_payload: {
          errorId: error.id,
          errorType: error.type,
          attemptCount
        },
        response_status: 200,
        response_body: {
          message: 'Recovery successful',
          originalError: error.message
        },
        duration_ms: 0,
        timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('GPS51ErrorHandler: Failed to log recovery:', logError);
    }
  }

  public clearHistory(): void {
    this.errorHistory = [];
    console.log('GPS51ErrorHandler: Error history cleared');
  }
}

export const gps51ErrorHandler = GPS51CentralizedErrorHandler.getInstance();