
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GPS51CredentialsForm } from './GPS51CredentialsForm';
import GPS51DeviceManager from './GPS51DeviceManager';
import { GPS51EnhancedDeviceManager } from './GPS51EnhancedDeviceManager';
import { GPS51CronJobManager } from './GPS51CronJobManager';
// GPS51RealTimeActivationPanel removed
import { GPS51DebugPanel } from './GPS51DebugPanel';
import { GPS51DeviceRecoveryTool } from './GPS51DeviceRecoveryTool';
import { GPS51SupabaseSecretsTest } from './GPS51SupabaseSecretsTest';
import { GPS51BatchSyncPanel } from './GPS51BatchSyncPanel';
import { GPS51ConnectivityDiagnostics } from './GPS51ConnectivityDiagnostics';
import { GPS51AuthDiagnosticsPanel } from './GPS51AuthDiagnosticsPanel';
import { GPS51EmergencyRecoveryPanel } from './GPS51EmergencyRecoveryPanel';
import { GPS51EmergencyControls } from './GPS51EmergencyControls';
import { GPS51AuthDiagnostics } from '../debug/GPS51AuthDiagnostics';

export const GPS51Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">GPS51 Integration</h2>
        <p className="text-slate-600">
          Configure and manage your GPS51 platform integration for real-time vehicle tracking.
        </p>
      </div>

      <Tabs defaultValue="emergency" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
          <TabsTrigger value="activation">Real-Time</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="emergency">
          <GPS51EmergencyControls />
        </TabsContent>

        <TabsContent value="activation">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Real-time activation moved to Production Control Center in Debug tab</p>
          </div>
        </TabsContent>

        <TabsContent value="credentials">
          <div className="space-y-6">
            <GPS51CredentialsForm />
            <GPS51ConnectivityDiagnostics />
          </div>
        </TabsContent>

        <TabsContent value="devices">
          <div className="space-y-6">
            <GPS51EnhancedDeviceManager />
            <GPS51DeviceManager />
          </div>
        </TabsContent>

        <TabsContent value="sync">
          <GPS51BatchSyncPanel />
        </TabsContent>

        <TabsContent value="recovery">
          <GPS51EmergencyRecoveryPanel />
        </TabsContent>

        <TabsContent value="scheduler">
          <GPS51CronJobManager />
        </TabsContent>

        <TabsContent value="debug">
          <div className="space-y-6">
            <GPS51AuthDiagnostics />
            <GPS51AuthDiagnosticsPanel />
            <GPS51SupabaseSecretsTest />
            <GPS51DeviceRecoveryTool />
            <GPS51DebugPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
