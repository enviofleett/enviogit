import { useState, useEffect } from 'react';

// Stub implementation until database schema is ready
export const useGPS51LiveData = () => {
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    devices,
    positions,
    isConnected,
    loading,
    error,
    startRealTimeSync: () => Promise.resolve(),
    stopRealTimeSync: () => Promise.resolve(),
    refreshData: () => Promise.resolve()
  };
};