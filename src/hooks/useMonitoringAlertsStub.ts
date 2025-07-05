import { useState } from 'react';

// Stub implementation until database schema is ready
export const useMonitoringAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    alerts,
    loading,
    error,
    refresh: () => Promise.resolve(),
    dismissAlert: () => Promise.resolve()
  };
};