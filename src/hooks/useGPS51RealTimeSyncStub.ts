import { useState } from 'react';

// Stub implementation until database schema is ready
export const useGPS51RealTimeSync = () => {
  const [isActive, setIsActive] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  return {
    isActive,
    lastSync,
    error,
    startSync: () => Promise.resolve(),
    stopSync: () => Promise.resolve(),
    forceSync: () => Promise.resolve()
  };
};