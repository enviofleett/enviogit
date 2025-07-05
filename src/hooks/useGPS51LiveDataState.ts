import { useState, useCallback } from 'react';

export interface LiveDataState {
  devices: any[];
  positions: any[];
  lastUpdate: Date | null;
}

export const useGPS51LiveDataState = () => {
  const [liveData, setLiveData] = useState<LiveDataState>({
    devices: [],
    positions: [],
    lastUpdate: null
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
    setLoading(false);
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