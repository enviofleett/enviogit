import React from 'react';
import { SyntheticMonitoringDashboard } from '@/components/developer/SyntheticMonitoringDashboard';
import { TestScenarioManager } from '@/components/developer/TestScenarioManager';
import { TestEnvironmentManager } from '@/components/developer/TestEnvironmentManager';
import { AlertsManager } from '@/components/developer/AlertsManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  TestTube, 
  Settings, 
  AlertTriangle,
  Code,
  Monitor,
  Zap,
  BarChart3
} from 'lucide-react';

const Developer = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
            <Code className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Developer Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Synthetic User Experience Monitoring & E2E Testing System
        </p>
      </div>
      
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test Scenarios
          </TabsTrigger>
          <TabsTrigger value="environments" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Environments
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <SyntheticMonitoringDashboard />
        </TabsContent>
        
        <TabsContent value="scenarios">
          <TestScenarioManager />
        </TabsContent>
        
        <TabsContent value="environments">
          <TestEnvironmentManager />
        </TabsContent>
        
        <TabsContent value="alerts">
          <AlertsManager />
        </TabsContent>
        
        <TabsContent value="analytics">
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Test Analytics</h3>
            </div>
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Advanced analytics coming soon...</p>
              <p className="text-sm mt-2">Historical trends, performance insights, and more</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Developer;