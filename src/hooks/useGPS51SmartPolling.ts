import { useState, useEffect, useCallback, useRef } from 'react';
import { useGPS51DirectVehicles } from './useGPS51DirectVehicles';
import { useGPS51DirectPositions } from './useGPS51DirectPositions';
import type { GPS51Device, PositionFilter } from '../services/gps51/direct';

export interface SmartPollingConfig {
  baseInterval: number; // Base polling interval in ms
  maxInterval: number;   // Maximum interval in ms
  minInterval: number;   // Minimum interval in ms
  activityThreshold: number; // Minutes to consider vehicle active
  adaptationFactor: number;  // How aggressively to adapt (1.0 - 3.0)
}

export interface SmartPollingState {
  isActive: boolean;
  currentInterval: number;
  activeDevices: number;
  inactiveDevices: number;
  lastAdaptation: number;
  pollingEfficiency: number;
}

export interface UseGPS51SmartPollingReturn {
  state: SmartPollingState;
  startSmartPolling: (deviceIds?: string[], filter?: PositionFilter) => void;
  stopSmartPolling: () => void;
  adjustConfig: (config: Partial<SmartPollingConfig>) => void;
  getOptimalInterval: () => number;
}

const DEFAULT_CONFIG: SmartPollingConfig = {
  baseInterval: 30000,    // 30 seconds
  maxInterval: 300000,    // 5 minutes
  minInterval: 10000,     // 10 seconds
  activityThreshold: 30,  // 30 minutes
  adaptationFactor: 2.0
};

export function useGPS51SmartPolling(
  initialConfig: Partial<SmartPollingConfig> = {}
): UseGPS51SmartPollingReturn {
  const [config, setConfig] = useState<SmartPollingConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });

  const [state, setState] = useState<SmartPollingState>({
    isActive: false,
    currentInterval: config.baseInterval,
    activeDevices: 0,
    inactiveDevices: 0,
    lastAdaptation: 0,
    pollingEfficiency: 100
  });

  const vehicles = useGPS51DirectVehicles({ autoRefresh: false });
  const positions = useGPS51DirectPositions({ autoStart: false });

  const adaptationTimer = useRef<NodeJS.Timeout | null>(null);
  const pollingHistory = useRef<{ timestamp: number; hasData: boolean; deviceCount: number }[]>([]);

  // Calculate optimal polling interval based on device activity
  const calculateOptimalInterval = useCallback((devices: GPS51Device[]): number => {
    const now = Date.now();
    const thresholdTime = now - (config.activityThreshold * 60 * 1000);

    const activeDevices = devices.filter(device => 
      device.lastactivetime && device.lastactivetime > thresholdTime
    );

    const inactiveDevices = devices.length - activeDevices.length;
    const activityRatio = devices.length > 0 ? activeDevices.length / devices.length : 0;

    // Calculate base interval adjustment
    let intervalMultiplier = 1.0;

    if (activityRatio > 0.8) {
      // High activity - faster polling
      intervalMultiplier = 0.5;
    } else if (activityRatio > 0.5) {
      // Medium activity - normal polling
      intervalMultiplier = 1.0;
    } else if (activityRatio > 0.2) {
      // Low activity - slower polling
      intervalMultiplier = 1.5;
    } else {
      // Very low activity - much slower polling
      intervalMultiplier = config.adaptationFactor;
    }

    // Factor in recent polling efficiency
    const recentHistory = pollingHistory.current.slice(-10);
    const emptyPolls = recentHistory.filter(h => !h.hasData).length;
    const efficiencyPenalty = emptyPolls > 5 ? 1.5 : 1.0;

    const optimalInterval = Math.min(
      Math.max(
        config.baseInterval * intervalMultiplier * efficiencyPenalty,
        config.minInterval
      ),
      config.maxInterval
    );

    setState(prev => ({
      ...prev,
      activeDevices: activeDevices.length,
      inactiveDevices,
      pollingEfficiency: Math.max(0, 100 - (emptyPolls * 10))
    }));

    console.log('Smart Polling Analysis:', {
      totalDevices: devices.length,
      activeDevices: activeDevices.length,
      activityRatio: Math.round(activityRatio * 100),
      intervalMultiplier,
      efficiencyPenalty,
      optimalInterval,
      emptyPolls
    });

    return Math.round(optimalInterval);
  }, [config]);

  // Adapt polling interval based on activity
  const adaptPollingInterval = useCallback(() => {
    if (!vehicles.hasVehicles || !state.isActive) return;

    const optimalInterval = calculateOptimalInterval(vehicles.state.vehicles);
    
    if (Math.abs(optimalInterval - state.currentInterval) > 5000) { // 5 second threshold
      setState(prev => ({
        ...prev,
        currentInterval: optimalInterval,
        lastAdaptation: Date.now()
      }));

      console.log('Smart Polling: Interval adapted to', optimalInterval + 'ms');
    }
  }, [vehicles.hasVehicles, vehicles.state.vehicles, state.isActive, state.currentInterval, calculateOptimalInterval]);

  // Start smart polling
  const startSmartPolling = useCallback((deviceIds?: string[], filter?: PositionFilter) => {
    console.log('Smart Polling: Starting intelligent polling...');

    setState(prev => ({ ...prev, isActive: true }));

    // Start position polling with adaptive interval
    positions.actions.startPolling(deviceIds, filter);

    // Set up adaptation timer
    if (adaptationTimer.current) {
      clearInterval(adaptationTimer.current);
    }

    adaptationTimer.current = setInterval(() => {
      adaptPollingInterval();
    }, 60000); // Adapt every minute

    // Initial adaptation
    setTimeout(adaptPollingInterval, 5000);
  }, [positions.actions, adaptPollingInterval]);

  // Stop smart polling
  const stopSmartPolling = useCallback(() => {
    console.log('Smart Polling: Stopping intelligent polling...');

    setState(prev => ({ ...prev, isActive: false }));
    positions.actions.stopPolling();

    if (adaptationTimer.current) {
      clearInterval(adaptationTimer.current);
      adaptationTimer.current = null;
    }
  }, [positions.actions]);

  // Update config
  const adjustConfig = useCallback((newConfig: Partial<SmartPollingConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    console.log('Smart Polling: Config updated', newConfig);
  }, []);

  // Get current optimal interval
  const getOptimalInterval = useCallback(() => {
    if (!vehicles.hasVehicles) return config.baseInterval;
    return calculateOptimalInterval(vehicles.state.vehicles);
  }, [vehicles.hasVehicles, vehicles.state.vehicles, calculateOptimalInterval, config.baseInterval]);

  // Track polling history
  useEffect(() => {
    if (positions.state.hasNewData !== undefined) {
      pollingHistory.current.push({
        timestamp: Date.now(),
        hasData: positions.state.hasNewData,
        deviceCount: positions.state.positions.length
      });

      // Keep only recent history
      if (pollingHistory.current.length > 50) {
        pollingHistory.current = pollingHistory.current.slice(-50);
      }
    }
  }, [positions.state.hasNewData, positions.state.positions.length]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (adaptationTimer.current) {
        clearInterval(adaptationTimer.current);
      }
    };
  }, []);

  return {
    state,
    startSmartPolling,
    stopSmartPolling,
    adjustConfig,
    getOptimalInterval
  };
}
