import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51DirectManager } from '../services/gps51/direct';
import type { 
  GPS51AuthCredentials, 
  GPS51User, 
  GPS51AuthResult, 
  GPS51AuthState 
} from '../services/gps51/direct';
import { useToast } from './use-toast';

export interface UseGPS51DirectAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: GPS51User | null;
  error: string | null;
  lastAuthAttempt: number;
  authErrors: number;
  connectionHealth: {
    isHealthy: boolean;
    latency: number;
    lastCheck: number;
  } | null;
}

export interface UseGPS51DirectAuthActions {
  authenticate: (credentials: GPS51AuthCredentials) => Promise<GPS51AuthResult>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  testConnection: () => Promise<void>;
  clearError: () => void;
}

export interface UseGPS51DirectAuthReturn {
  state: UseGPS51DirectAuthState;
  actions: UseGPS51DirectAuthActions;
  // Convenience properties
  isReady: boolean;
  hasError: boolean;
  canRetry: boolean;
}

export function useGPS51DirectAuth(): UseGPS51DirectAuthReturn {
  const { toast } = useToast();
  const [state, setState] = useState<UseGPS51DirectAuthState>({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    error: null,
    lastAuthAttempt: 0,
    authErrors: 0,
    connectionHealth: null
  });

  const isInitialized = useRef(false);
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize authentication state from service
  useEffect(() => {
    if (!isInitialized.current) {
      const authState = gps51DirectManager.auth.getAuthState();
      setState(prev => ({
        ...prev,
        isAuthenticated: authState.isAuthenticated,
        user: authState.user,
        lastAuthAttempt: authState.lastAuthAttempt,
        authErrors: authState.authErrors
      }));
      isInitialized.current = true;

      // Start health monitoring if authenticated
      if (authState.isAuthenticated) {
        startHealthMonitoring();
      }
    }
  }, []);

  // Start periodic health checks
  const startHealthMonitoring = useCallback(() => {
    if (healthCheckInterval.current) {
      clearInterval(healthCheckInterval.current);
    }

    healthCheckInterval.current = setInterval(async () => {
      if (gps51DirectManager.auth.isAuthenticated()) {
        try {
          const healthResult = await gps51DirectManager.auth.testConnection();
          setState(prev => ({
            ...prev,
            connectionHealth: {
              isHealthy: healthResult.success,
              latency: healthResult.latency || 0,
              lastCheck: Date.now()
            }
          }));
        } catch (error) {
          setState(prev => ({
            ...prev,
            connectionHealth: {
              isHealthy: false,
              latency: 0,
              lastCheck: Date.now()
            }
          }));
        }
      }
    }, 60000); // Check every minute
  }, []);

  // Stop health monitoring
  const stopHealthMonitoring = useCallback(() => {
    if (healthCheckInterval.current) {
      clearInterval(healthCheckInterval.current);
      healthCheckInterval.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHealthMonitoring();
    };
  }, [stopHealthMonitoring]);

  const authenticate = useCallback(async (credentials: GPS51AuthCredentials): Promise<GPS51AuthResult> => {
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null 
    }));

    try {
      console.log('useGPS51DirectAuth: Starting authentication...');
      
      const result = await gps51DirectManager.auth.authenticate(credentials);
      
      const authState = gps51DirectManager.auth.getAuthState();
      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthenticated: result.success,
        user: result.user || null,
        error: result.success ? null : (result.error || 'Authentication failed'),
        lastAuthAttempt: authState.lastAuthAttempt,
        authErrors: authState.authErrors
      }));

      if (result.success) {
        toast({
          title: "Authentication Successful",
          description: `Logged in as ${result.user?.username || 'user'}`,
        });
        
        // Start health monitoring
        startHealthMonitoring();
      } else {
        toast({
          title: "Authentication Failed",
          description: result.error || 'Please check your credentials',
          variant: "destructive",
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication error';
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        error: errorMessage,
        authErrors: prev.authErrors + 1
      }));

      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [toast, startHealthMonitoring]);

  const logout = useCallback(() => {
    console.log('useGPS51DirectAuth: Logging out...');
    
    gps51DirectManager.auth.logout();
    stopHealthMonitoring();
    
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
      lastAuthAttempt: 0,
      authErrors: 0,
      connectionHealth: null
    });

    toast({
      title: "Logged Out",
      description: "Successfully logged out of GPS51",
    });
  }, [toast, stopHealthMonitoring]);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log('useGPS51DirectAuth: Refreshing token...');
      
      const result = await gps51DirectManager.auth.refreshToken();
      
      if (result && result.success) {
        const authState = gps51DirectManager.auth.getAuthState();
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          user: result.user || prev.user,
          error: null,
          lastAuthAttempt: authState.lastAuthAttempt
        }));
        
        console.log('useGPS51DirectAuth: Token refresh successful');
        return true;
      } else {
        console.warn('useGPS51DirectAuth: Token refresh failed');
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          error: 'Token refresh failed'
        }));
        return false;
      }
    } catch (error) {
      console.error('useGPS51DirectAuth: Token refresh error:', error);
      setState(prev => ({
        ...prev,
        error: 'Token refresh failed'
      }));
      return false;
    }
  }, []);

  const testConnection = useCallback(async (): Promise<void> => {
    try {
      console.log('useGPS51DirectAuth: Testing connection...');
      
      const healthResult = await gps51DirectManager.auth.testConnection();
      
      setState(prev => ({
        ...prev,
        connectionHealth: {
          isHealthy: healthResult.success,
          latency: healthResult.latency || 0,
          lastCheck: Date.now()
        },
        error: healthResult.success ? null : healthResult.error || 'Connection test failed'
      }));

      if (healthResult.success) {
        toast({
          title: "Connection Test Successful",
          description: `Latency: ${healthResult.latency}ms`,
        });
      } else {
        toast({
          title: "Connection Test Failed",
          description: healthResult.error || 'Connection test failed',
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test error';
      setState(prev => ({
        ...prev,
        connectionHealth: {
          isHealthy: false,
          latency: 0,
          lastCheck: Date.now()
        },
        error: errorMessage
      }));

      toast({
        title: "Connection Test Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [toast]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const actions: UseGPS51DirectAuthActions = {
    authenticate,
    logout,
    refreshToken,
    testConnection,
    clearError
  };

  const isReady = state.isAuthenticated && !state.isLoading && !state.error;
  const hasError = !!state.error;
  const canRetry = state.authErrors < 3 && !state.isLoading;

  return {
    state,
    actions,
    isReady,
    hasError,
    canRetry
  };
}