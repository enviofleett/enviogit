import { useState, useEffect, useCallback } from 'react';
import { gps51ProductionDataBridge } from '@/services/gps51/GPS51ProductionDataBridge';
import { gps51ProductionHealthMonitor } from '@/services/gps51/GPS51ProductionHealthMonitor';
import { useToast } from './use-toast';

export interface ProductionDataState {
  vehicles: any[];
  positions: any[];
  isLoading: boolean;
  isReady: boolean;
  lastUpdate: Date | null;
  healthStatus: any;
  errors: string[];
}

export interface ProductionDataActions {
  refresh: () => Promise<void>;
  reset: () => void;
  getHealthReport: () => Promise<any>;
}

/**
 * Production-grade hook for GPS51 data with reliable error handling
 */
export function useGPS51ProductionData(): {
  state: ProductionDataState;
  actions: ProductionDataActions;
} {
  const { toast } = useToast();
  
  const [state, setState] = useState<ProductionDataState>({
    vehicles: [],
    positions: [],
    isLoading: true,
    isReady: false,
    lastUpdate: null,
    healthStatus: null,
    errors: []
  });

  // Initialize production data bridge
  useEffect(() => {
    let mounted = true;

    const initializeProduction = async () => {
      try {
        console.log('useGPS51ProductionData: Initializing production data system...');
        
        const initialized = await gps51ProductionDataBridge.initializeDataBridge();
        
        if (mounted) {
          if (initialized) {
            setState(prev => ({ 
              ...prev, 
              isLoading: false, 
              isReady: true,
              errors: []
            }));
            
            // Get initial data if available
            const cachedData = gps51ProductionDataBridge.getDashboardData();
            if (cachedData) {
              setState(prev => ({
                ...prev,
                vehicles: cachedData.devices || [],
                positions: cachedData.positions || [],
                lastUpdate: cachedData.lastUpdate
              }));
            }
            
            toast({
              title: "GPS51 System Ready",
              description: "Production data system initialized successfully",
            });
          } else {
            setState(prev => ({ 
              ...prev, 
              isLoading: false, 
              isReady: false,
              errors: ['Failed to initialize production data system']
            }));
            
            toast({
              title: "GPS51 System Error",
              description: "Failed to initialize data system. Check credentials and connection.",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        if (mounted) {
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            isReady: false,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          }));
        }
      }
    };

    initializeProduction();

    return () => {
      mounted = false;
    };
  }, [toast]);

  // Listen for data updates
  useEffect(() => {
    const handleDataUpdate = (event: CustomEvent) => {
      const data = event.detail;
      console.log('useGPS51ProductionData: Data update received:', {
        devices: data.devices?.length || 0,
        positions: data.positions?.length || 0
      });
      
      setState(prev => ({
        ...prev,
        vehicles: data.devices || [],
        positions: data.positions || [],
        lastUpdate: data.lastUpdate || new Date(),
        isReady: true,
        errors: []
      }));
    };

    const handleHealthUpdate = (event: CustomEvent) => {
      const healthData = event.detail;
      setState(prev => ({
        ...prev,
        healthStatus: healthData
      }));
    };

    window.addEventListener('gps51-dashboard-data-update', handleDataUpdate as EventListener);
    window.addEventListener('gps51-health-update', handleHealthUpdate as EventListener);

    return () => {
      window.removeEventListener('gps51-dashboard-data-update', handleDataUpdate as EventListener);
      window.removeEventListener('gps51-health-update', handleHealthUpdate as EventListener);
    };
  }, []);

  // Manual refresh action
  const refresh = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, errors: [] }));
      
      await gps51ProductionDataBridge.triggerDataRefresh();
      
      toast({
        title: "Data Refreshed",
        description: "GPS51 data has been refreshed successfully",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Refresh failed';
      
      setState(prev => ({ 
        ...prev, 
        errors: [...prev.errors, errorMessage]
      }));
      
      toast({
        title: "Refresh Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [toast]);

  // Reset action
  const reset = useCallback(() => {
    gps51ProductionDataBridge.reset();
    setState({
      vehicles: [],
      positions: [],
      isLoading: false,
      isReady: false,
      lastUpdate: null,
      healthStatus: null,
      errors: []
    });
    
    toast({
      title: "System Reset",
      description: "GPS51 system has been reset",
    });
  }, [toast]);

  // Get health report
  const getHealthReport = useCallback(async () => {
    try {
      return await gps51ProductionHealthMonitor.performHealthCheck();
    } catch (error) {
      console.error('useGPS51ProductionData: Health check failed:', error);
      return null;
    }
  }, []);

  return {
    state,
    actions: {
      refresh,
      reset,
      getHealthReport
    }
  };
}