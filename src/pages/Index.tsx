import React from 'react';
import { EmergencyGPS51Dashboard } from '@/components/dashboard/EmergencyGPS51Dashboard';

const Index = () => {
  // PHASE 3 EMERGENCY: Replace all GPS51 services with emergency version
  console.log('🚨 Index page using Emergency GPS51 Dashboard to prevent API spikes');
  
  return (
    <div className="min-h-screen bg-background">
      <EmergencyGPS51Dashboard apiUrl="https://api.gps51.com/openapi" />
    </div>
  );
};

export default Index;
