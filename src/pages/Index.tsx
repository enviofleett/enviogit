import React from 'react';
import Dashboard from './Dashboard';
import { UnauthenticatedDashboard } from '@/components/dashboard/UnauthenticatedDashboard';
import { useGPS51SessionStatus } from '@/hooks/useGPS51SessionStatus';

const Index = () => {
  const { status } = useGPS51SessionStatus();
  
  // Show unauthenticated dashboard if not authenticated
  if (!status.isAuthenticated) {
    return <UnauthenticatedDashboard />;
  }
  
  // Show main dashboard if authenticated
  return <Dashboard />;
};

export default Index;
