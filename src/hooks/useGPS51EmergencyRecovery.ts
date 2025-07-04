import { useState, useCallback } from 'react';
import { gps51DataRecoveryService, RecoveryReport } from '@/services/gps51/GPS51DataRecoveryService';
import { useToast } from './use-toast';
import { gps51AuthService } from '@/services/gp51/GPS51AuthService';

export interface UseGPS51EmergencyRecoveryReturn {
  isRecovering: boolean;
  recoveryReport: RecoveryReport | null;
  progress: number;
  isAuthenticated: boolean;
  startRecovery: () => Promise<void>;
  reset: () => void;
  getRecoveryStats: () => {
    processedDevices: number;
    failedDevices: number;
    successRate: number;
  };
}

export function useGPS51EmergencyRecovery(): UseGPS51EmergencyRecoveryReturn {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReport | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const isAuthenticated = gps51AuthService.isAuthenticated();

  const startRecovery = useCallback(async () => {
    if (isRecovering) return;

    setIsRecovering(true);
    setProgress(0);
    setRecoveryReport(null);

    try {
      // Start progress simulation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const increment = Math.random() * 10 + 5; // 5-15% increments
          return Math.min(prev + increment, 90);
        });
      }, 1500);

      console.log('Starting GPS51 emergency recovery...');
      const report = await gps51DataRecoveryService.emergencyDataRecovery();
      
      // Complete progress
      clearInterval(progressInterval);
      setProgress(100);
      setRecoveryReport(report);

      // Show success toast
      toast({
        title: "Emergency Recovery Completed",
        description: `Successfully processed ${report.totalDevicesProcessed} devices, recovered ${report.summary.positionsRecovered} positions`,
      });

      // Log success
      console.log('GPS51 emergency recovery completed:', {
        totalProcessed: report.totalDevicesProcessed,
        successfullyFixed: report.successfullyFixed,
        executionTime: `${Math.round(report.executionTimeMs / 1000)}s`,
        emergencyNeeded: report.summary.emergencyRecoveryNeeded
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('GPS51 emergency recovery failed:', error);
      
      toast({
        title: "Emergency Recovery Failed",
        description: errorMessage,
        variant: "destructive",
      });

      // Set error state
      setRecoveryReport({
        timestamp: new Date().toISOString(),
        totalDevicesProcessed: 0,
        successfullyFixed: 0,
        failedDevices: 0,
        criticalIssuesFound: 1,
        executionTimeMs: 0,
        deviceResults: [],
        summary: {
          positionsRecovered: 0,
          dataQualityImproved: 0,
          emergencyRecoveryNeeded: true
        }
      });
    } finally {
      setIsRecovering(false);
      setTimeout(() => setProgress(0), 2000); // Reset progress after 2 seconds
    }
  }, [isRecovering, toast]);

  const reset = useCallback(() => {
    setRecoveryReport(null);
    setProgress(0);
    gps51DataRecoveryService.reset();
  }, []);

  const getRecoveryStats = useCallback(() => {
    return gps51DataRecoveryService.getRecoveryStats();
  }, []);

  return {
    isRecovering,
    recoveryReport,
    progress,
    isAuthenticated,
    startRecovery,
    reset,
    getRecoveryStats
  };
}

export default useGPS51EmergencyRecovery;