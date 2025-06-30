
import { useState, useCallback } from 'react';
import { LiveDataState } from '@/services/gps51/GPS51LiveDataService';
import { GPS51Device, GPS51Position } from '@/services/gps51/types';

export const useGPS51LiveDataState = () => {
  const [liveData, setLiveData] = useState<LiveDataState>({
    lastQueryPositionTime: 0,
    devices: [],
    positions: [],
    lastUpdate: new Date()
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLiveData = useCallback((data: LiveDataState) => {
    setLiveData(data);
    setError(null);
  }, []);

  const setLoadingState = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  const setErrorState = useCallback((errorMessage: string | null) => {
    setError(errorMessage);
  }, []);

  return {
    liveData,
    loading,
    error,
    updateLiveData,
    setLoadingState,
    setErrorState
  };
};
