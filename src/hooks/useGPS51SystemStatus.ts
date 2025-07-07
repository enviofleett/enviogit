import { gps51IntegrationConsolidator } from '@/services/gps51/GPS51IntegrationConsolidator';
import { GPS51CORSValidator } from '@/services/gps51/GPS51CORSValidator';
import { emergencyModeManager } from '@/services/monitoring/EmergencyModeManager';
import { useToast } from '@/hooks/use-toast';

/**
 * Phase 2: GPS51 System Status Monitor
 * Monitors the consolidated GPS51 integration health
 */
export function useGPS51SystemStatus() {
  const { toast } = useToast();

  const checkSystemStatus = async () => {
    console.log('useGPS51SystemStatus: Phase 2 system check starting...');

    // 1. Check emergency mode status
    const emergencyMode = emergencyModeManager.isEmergencyMode();
    
    // 2. Check integration consolidation
    const consolidationStatus = await gps51IntegrationConsolidator.consolidateGPS51Integration();
    
    // 3. Validate CORS configuration
    const corsStatus = await GPS51CORSValidator.validateCORS();

    const systemStatus = {
      emergencyMode,
      consolidated: consolidationStatus.consolidated,
      corsConfigured: corsStatus.isValid,
      activeDataSources: consolidationStatus.activeDataSources,
      recommendations: [
        ...consolidationStatus.activeDataSources.length > 1 ? ['Multiple GPS51 data sources detected'] : [],
        ...!corsStatus.isValid ? corsStatus.recommendations : [],
        ...emergencyMode ? ['Emergency mode active - API spikes prevented'] : []
      ]
    };

    console.log('useGPS51SystemStatus: Phase 2 system status:', systemStatus);

    // Show user notification if issues detected
    if (!consolidationStatus.consolidated || !corsStatus.isValid) {
      toast({
        title: "GPS51 System Status",
        description: `Integration: ${consolidationStatus.consolidated ? 'OK' : 'Issues'}, CORS: ${corsStatus.isValid ? 'OK' : 'Issues'}`,
        variant: emergencyMode ? "default" : "destructive"
      });
    }

    return systemStatus;
  };

  const forceOptimization = async () => {
    console.log('useGPS51SystemStatus: Forcing Phase 2 optimization...');
    
    await gps51IntegrationConsolidator.forceConsolidation();
    
    toast({
      title: "GPS51 Optimization",
      description: "Forced consolidation to single optimized data path",
    });
  };

  const getCORSTroubleshooting = () => {
    return GPS51CORSValidator.getCORSTroubleshootingSteps();
  };

  return {
    checkSystemStatus,
    forceOptimization,
    getCORSTroubleshooting,
    emergencyModeActive: emergencyModeManager.isEmergencyMode()
  };
}