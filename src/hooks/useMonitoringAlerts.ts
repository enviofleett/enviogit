
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AlertConfig {
  id: string;
  name: string;
  type: 'vehicle_offline' | 'sync_failure' | 'api_limit' | 'low_battery' | 'geofence_violation';
  enabled: boolean;
  threshold: number;
  timeWindow: number; // in minutes
  recipients: string[];
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  vehicleId?: string;
  vehicleName?: string;
  timestamp: Date;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

interface ApiUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  dailyLimit: number;
  remainingQuota: number;
}

export const useMonitoringAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [apiUsageStats, setApiUsageStats] = useState<ApiUsageStats>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    dailyLimit: 10000,
    remainingQuota: 10000
  });

  // Initialize default alert configurations
  useEffect(() => {
    const defaultConfigs: AlertConfig[] = [
      {
        id: 'vehicle-offline',
        name: 'Vehicle Offline Alert',
        type: 'vehicle_offline',
        enabled: true,
        threshold: 60, // 60 minutes
        timeWindow: 60,
        recipients: ['fleet@company.com']
      },
      {
        id: 'sync-failure',
        name: 'GPS51 Sync Failure',
        type: 'sync_failure',
        enabled: true,
        threshold: 3, // 3 consecutive failures
        timeWindow: 30,
        recipients: ['tech@company.com']
      },
      {
        id: 'api-limit',
        name: 'API Usage Limit Warning',
        type: 'api_limit',
        enabled: true,
        threshold: 80, // 80% of daily limit
        timeWindow: 1440, // 24 hours
        recipients: ['admin@company.com']
      }
    ];

    setAlertConfigs(defaultConfigs);
  }, []);

  const checkVehicleOfflineAlerts = useCallback(async () => {
    const offlineConfig = alertConfigs.find(c => c.type === 'vehicle_offline' && c.enabled);
    if (!offlineConfig) return;

    try {
      const thresholdTime = new Date(Date.now() - offlineConfig.threshold * 60 * 1000);
      
      const { data: offlineVehicles, error } = await supabase
        .from('vehicles')
        .select(`
          id,
          license_plate,
          brand,
          model,
          vehicle_positions!left(timestamp)
        `)
        .not('gps51_device_id', 'is', null);

      if (error) {
        console.error('Error checking offline vehicles:', error);
        return;
      }

      offlineVehicles?.forEach(vehicle => {
        const latestPosition = Array.isArray(vehicle.vehicle_positions) 
          ? vehicle.vehicle_positions.sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )[0]
          : vehicle.vehicle_positions;

        const lastUpdate = latestPosition ? new Date(latestPosition.timestamp) : null;
        const isOffline = !lastUpdate || lastUpdate < thresholdTime;

        if (isOffline) {
          const existingAlert = alerts.find(a => 
            a.type === 'vehicle_offline' && 
            a.vehicleId === vehicle.id && 
            !a.acknowledged
          );

          if (!existingAlert) {
            const newAlert: Alert = {
              id: crypto.randomUUID(),
              type: 'vehicle_offline',
              severity: 'high',
              title: 'Vehicle Offline',
              message: `Vehicle ${vehicle.license_plate} hasn't reported in ${offlineConfig.threshold} minutes`,
              vehicleId: vehicle.id,
              vehicleName: `${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})`,
              timestamp: new Date(),
              acknowledged: false,
              metadata: {
                lastSeen: lastUpdate?.toISOString() || 'Never',
                thresholdMinutes: offlineConfig.threshold
              }
            };

            setAlerts(prev => [newAlert, ...prev]);
          }
        }
      });
    } catch (error) {
      console.error('Error in checkVehicleOfflineAlerts:', error);
    }
  }, [alertConfigs, alerts]);

  const checkSyncFailureAlerts = useCallback(async () => {
    const syncConfig = alertConfigs.find(c => c.type === 'sync_failure' && c.enabled);
    if (!syncConfig) return;

    try {
      const { data: recentJobs, error } = await supabase
        .from('gps51_sync_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(syncConfig.threshold);

      if (error) {
        console.error('Error checking sync failures:', error);
        return;
      }

      const failedJobs = recentJobs?.filter(job => job.success === false) || [];
      
      if (failedJobs.length >= syncConfig.threshold) {
        const existingAlert = alerts.find(a => 
          a.type === 'sync_failure' && 
          !a.acknowledged &&
          Date.now() - a.timestamp.getTime() < syncConfig.timeWindow * 60 * 1000
        );

        if (!existingAlert) {
          const newAlert: Alert = {
            id: crypto.randomUUID(),
            type: 'sync_failure',
            severity: 'critical',
            title: 'GPS51 Sync Failures',
            message: `${failedJobs.length} consecutive sync failures detected`,
            timestamp: new Date(),
            acknowledged: false,
            metadata: {
              failedJobs: failedJobs.map(job => ({
                id: job.id,
                error: job.error_message,
                timestamp: job.started_at
              }))
            }
          };

          setAlerts(prev => [newAlert, ...prev]);
        }
      }
    } catch (error) {
      console.error('Error in checkSyncFailureAlerts:', error);
    }
  }, [alertConfigs, alerts]);

  const updateApiUsageStats = useCallback(async () => {
    try {
      // This would typically come from your API usage tracking
      // For now, we'll simulate some stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const { data: todayJobs, error } = await supabase
        .from('gps51_sync_jobs')
        .select('success, execution_time_seconds')
        .gte('started_at', today.toISOString());

      if (!error && todayJobs) {
        const totalRequests = todayJobs.length;
        const successfulRequests = todayJobs.filter(job => job.success).length;
        const failedRequests = totalRequests - successfulRequests;
        const averageResponseTime = todayJobs.reduce((sum, job) => 
          sum + (job.execution_time_seconds || 0), 0
        ) / totalRequests || 0;

        const estimatedApiCalls = totalRequests * 3; // Assuming 3 API calls per sync job
        const dailyLimit = 10000;
        const remainingQuota = Math.max(0, dailyLimit - estimatedApiCalls);

        const newStats: ApiUsageStats = {
          totalRequests: estimatedApiCalls,
          successfulRequests: successfulRequests * 3,
          failedRequests: failedRequests * 3,
          averageResponseTime,
          dailyLimit,
          remainingQuota
        };

        setApiUsageStats(newStats);

        // Check API limit alert
        const apiConfig = alertConfigs.find(c => c.type === 'api_limit' && c.enabled);
        if (apiConfig) {
          const usagePercentage = (estimatedApiCalls / dailyLimit) * 100;
          
          if (usagePercentage >= apiConfig.threshold) {
            const existingAlert = alerts.find(a => 
              a.type === 'api_limit' && 
              !a.acknowledged &&
              a.timestamp.toDateString() === now.toDateString()
            );

            if (!existingAlert) {
              const newAlert: Alert = {
                id: crypto.randomUUID(),
                type: 'api_limit',
                severity: usagePercentage >= 95 ? 'critical' : 'medium',
                title: 'API Usage Warning',
                message: `GPS51 API usage at ${usagePercentage.toFixed(1)}% of daily limit`,
                timestamp: new Date(),
                acknowledged: false,
                metadata: {
                  usagePercentage,
                  remainingQuota,
                  dailyLimit
                }
              };

              setAlerts(prev => [newAlert, ...prev]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating API usage stats:', error);
    }
  }, [alertConfigs, alerts]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true }
        : alert
    ));
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  const updateAlertConfig = useCallback((configId: string, updates: Partial<AlertConfig>) => {
    setAlertConfigs(prev => prev.map(config => 
      config.id === configId 
        ? { ...config, ...updates }
        : config
    ));
  }, []);

  // Run monitoring checks periodically
  useEffect(() => {
    const runMonitoringChecks = () => {
      checkVehicleOfflineAlerts();
      checkSyncFailureAlerts();
      updateApiUsageStats();
    };

    // Run initial check
    runMonitoringChecks();

    // Set up periodic checks
    const interval = setInterval(runMonitoringChecks, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [checkVehicleOfflineAlerts, checkSyncFailureAlerts, updateApiUsageStats]);

  return {
    alerts: alerts.filter(a => !a.acknowledged).slice(0, 20), // Show latest 20 unacknowledged alerts
    allAlerts: alerts,
    alertConfigs,
    apiUsageStats,
    acknowledgeAlert,
    dismissAlert,
    updateAlertConfig
  };
};
