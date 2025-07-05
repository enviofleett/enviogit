import { useState, useCallback } from 'react';

interface AlertConfig {
  id: string;
  name: string;
  type: 'vehicle_offline' | 'sync_failure' | 'api_limit' | 'low_battery' | 'geofence_violation';
  enabled: boolean;
  threshold: number;
  timeWindow: number;
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

// Stub implementation until database schema is ready
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

  const acknowledgeAlert = useCallback((alertId: string) => {
    console.log('Monitoring alerts temporarily disabled - database schema pending');
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    console.log('Monitoring alerts temporarily disabled - database schema pending');
  }, []);

  const updateAlertConfig = useCallback((configId: string, updates: Partial<AlertConfig>) => {
    console.log('Alert config updates temporarily disabled - database schema pending');
  }, []);

  return {
    alerts,
    allAlerts: alerts,
    alertConfigs,
    apiUsageStats,
    acknowledgeAlert,
    dismissAlert,
    updateAlertConfig
  };
};