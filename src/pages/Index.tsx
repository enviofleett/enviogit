import React from 'react';
import Dashboard from './Dashboard';
import { UnauthenticatedDashboard } from '@/components/dashboard/UnauthenticatedDashboard';
// Session status removed - using simplified approach

const Index = () => {
  // Simplified - always show Dashboard for now
  return <Dashboard />;
};

export default Index;
