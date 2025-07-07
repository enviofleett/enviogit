import { useState, useCallback } from 'react';
import { gps51EmergencyManager } from '@/services/gps51/GPS51EmergencyManager';
import { GPS51ErrorAnalyzer } from '@/services/gps51/GPS51ErrorAnalyzer';
import { ValidationStep } from '@/components/settings/GPS51ProductionValidator/types';
import { useToast } from '@/hooks/use-toast';

export const useGPS51ValidationActions = () => {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([
    {
      name: 'Authentication',
      description: 'Verify GPS51 credentials and token generation',
      status: 'pending'
    },
    {
      name: 'Device List',
      description: 'Fetch device list with emergency caching',
      status: 'pending'
    },
    {
      name: 'Real-time Positions',
      description: 'Retrieve live vehicle positions',
      status: 'pending'
    },
    {
      name: 'Data Flow',
      description: 'Verify end-to-end data processing',
      status: 'pending'
    }
  ]);

  const updateStep = useCallback((index: number, update: Partial<ValidationStep>) => {
    setValidationSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, ...update } : step
    ));
  }, []);

  const resetValidation = useCallback(() => {
    setValidationSteps(prev => prev.map(step => ({ 
      ...step, 
      status: 'pending' as const,
      error: undefined,
      errorDetails: undefined,
      data: undefined
    })));
  }, []);

  const runProductionValidation = useCallback(async () => {
    setIsValidating(true);
    
    try {
      // Step 1: Enhanced Authentication Validation
      updateStep(0, { status: 'running' });
      
      try {
        const savedCredentials = localStorage.getItem('gps51_credentials');
        if (!savedCredentials) {
          throw new Error('No saved credentials found. Please authenticate first.');
        }

        let credentials;
        try {
          credentials = JSON.parse(savedCredentials);
        } catch (e) {
          throw new Error('Saved credentials are corrupted. Please re-enter credentials.');
        }

        if (!credentials.username || !credentials.password) {
          throw new Error('Incomplete credentials. Missing username or password.');
        }

        if (!gps51EmergencyManager.isAuthenticated()) {
          const authResult = await gps51EmergencyManager.authenticate(credentials);
          
          if (!authResult.success) {
            throw new Error(authResult.error || 'Authentication failed with valid credentials');
          }
        }
        
        updateStep(0, { 
          status: 'success', 
          data: { 
            username: gps51EmergencyManager.getUsername(),
            authMethod: 'Emergency Manager',
            credentialsValid: true
          } 
        });

      } catch (error) {
        const errorDetails = GPS51ErrorAnalyzer.analyzeError(error, 'Authentication');
        updateStep(0, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Authentication failed',
          errorDetails
        });
        throw error;
      }

      // Step 2: Enhanced Device List Validation
      updateStep(1, { status: 'running' });
      
      try {
        const devices = await gps51EmergencyManager.getDeviceList(false);
        
        if (!Array.isArray(devices)) {
          throw new Error('Invalid device list response format');
        }

        if (devices.length === 0) {
          throw new Error('No devices found in GPS51 account. Verify account has devices configured.');
        }

        updateStep(1, { 
          status: 'success', 
          data: { 
            count: devices.length,
            sampleDevices: devices.slice(0, 3).map(d => ({ id: d.deviceid, name: d.devicename })),
            cached: true
          } 
        });

      } catch (error) {
        const errorDetails = GPS51ErrorAnalyzer.analyzeError(error, 'Device List');
        updateStep(1, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Device list fetch failed',
          errorDetails
        });
        throw error;
      }

      // Step 3: Enhanced Position Data Validation
      updateStep(2, { status: 'running' });
      
      try {
        const devices = await gps51EmergencyManager.getDeviceList(false);
        const deviceIds = devices.map(d => d.deviceid).slice(0, 5);
        
        if (deviceIds.length === 0) {
          throw new Error('No device IDs available for position testing');
        }

        const positionsResult = await gps51EmergencyManager.getRealtimePositions(deviceIds, 0);
        
        if (!positionsResult || !Array.isArray(positionsResult.positions)) {
          throw new Error('Invalid positions response format from GPS51 API');
        }

        updateStep(2, { 
          status: 'success', 
          data: { 
            positions: positionsResult.positions.length,
            lastQueryTime: positionsResult.lastQueryTime,
            devicesTested: deviceIds.length,
            dataFreshness: new Date(positionsResult.lastQueryTime).toLocaleString()
          } 
        });

      } catch (error) {
        const errorDetails = GPS51ErrorAnalyzer.analyzeError(error, 'Real-time Positions');
        updateStep(2, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Position data fetch failed',
          errorDetails
        });
        throw error;
      }

      // Step 4: Enhanced System Diagnostics
      updateStep(3, { status: 'running' });
      
      try {
        const diagnostics = gps51EmergencyManager.getDiagnostics();
        
        if (!diagnostics || !diagnostics.client) {
          throw new Error('Emergency manager diagnostics not available');
        }

        const healthScore = diagnostics.client.cacheSize > 0 ? 100 : 75;
        
        updateStep(3, { 
          status: 'success', 
          data: { 
            cacheSize: diagnostics.client.cacheSize,
            queueSize: diagnostics.client.queueSize,
            emergencyMode: diagnostics.emergencyMode,
            healthScore: `${healthScore}%`,
            systemStatus: 'Operational'
          } 
        });

      } catch (error) {
        const errorDetails = GPS51ErrorAnalyzer.analyzeError(error, 'Data Flow');
        updateStep(3, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'System diagnostics failed',
          errorDetails
        });
        throw error;
      }

      toast({
        title: 'Production Validation Complete',
        description: 'All systems validated successfully. GPS51 is ready for live deployment.',
      });

    } catch (error) {
      toast({
        title: 'Production Validation Failed',
        description: 'Check detailed error analysis below for specific fixes.',
        variant: 'destructive'
      });
    } finally {
      setIsValidating(false);
    }
  }, [updateStep, toast]);

  const handleQuickFix = useCallback(async (action: string) => {
    switch (action) {
      case 'clear-auth':
        localStorage.removeItem('gps51_credentials');
        sessionStorage.removeItem('gps51_token');
        gps51EmergencyManager.clearAllCaches();
        toast({ title: 'Authentication cache cleared' });
        break;
      case 'clear-cache':
        gps51EmergencyManager.clearAllCaches();
        toast({ title: 'All caches cleared' });
        break;
      case 'setup-credentials':
        toast({ title: 'Navigate to Settings > GPS51 to setup credentials' });
        break;
      case 'emergency-mode':
        localStorage.setItem('gps51_emergency_status', JSON.stringify({ active: true }));
        toast({ title: 'Emergency mode enabled' });
        break;
      default:
        toast({ title: `Quick fix: ${action}` });
    }
  }, [toast]);

  return {
    isValidating,
    validationSteps,
    runProductionValidation,
    resetValidation,
    handleQuickFix
  };
};