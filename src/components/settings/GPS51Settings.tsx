
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GPS51UnifiedCredentialsPanel } from './GPS51UnifiedCredentialsPanel';
import GPS51DeviceManager from './GPS51DeviceManager';
import { GPS51CronJobManager } from './GPS51CronJobManager';
import { GPS51RealTimeActivationPanel } from './GPS51RealTimeActivationPanel';
import { GPS51DebugPanel } from './GPS51DebugPanel';
import { GPS51RealTimeTestPanel } from './GPS51RealTimeTestPanel';
import { GPS51OfflineDeviceDiagnostics } from './GPS51OfflineDeviceDiagnostics';
import { GPS51DeviceRecoveryTool } from './GPS51DeviceRecoveryTool';
import { GPS51SupabaseSecretsTest } from './GPS51SupabaseSecretsTest';
import { GPS51BatchSyncPanel } from './GPS51BatchSyncPanel';
import { GPS51ConnectivityDiagnostics } from './GPS51ConnectivityDiagnostics';
import { GPS51AuthDiagnosticsPanel } from './GPS51AuthDiagnosticsPanel';
import { GPS51ProductionReadinessPanel } from './GPS51ProductionReadinessPanel';
import { GPS51EmergencyRecoveryPanel } from './GPS51EmergencyRecoveryPanel';
import { GPS51EmergencyControlPanel } from './GPS51EmergencyControlPanel';
import { MaptilerSettingsPanel } from './MaptilerSettingsPanel';

export const GPS51Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">GPS51 Integration</h2>
        <p className="text-slate-600">
          Configure and manage your GPS51 platform integration for real-time vehicle tracking.
        </p>
      </div>

      <Tabs defaultValue="activation" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="activation">Real-Time</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="maps">Maps</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="activation">
          <GPS51RealTimeActivationPanel />
        </TabsContent>

        <TabsContent value="credentials">
          <div className="space-y-6">
            <GPS51UnifiedCredentialsPanel />
            <GPS51ConnectivityDiagnostics />
          </div>
        </TabsContent>

        <TabsContent value="devices">
          <GPS51DeviceManager />
        </TabsContent>

        <TabsContent value="sync">
          <GPS51BatchSyncPanel />
        </TabsContent>

        <TabsContent value="recovery">
          <div className="space-y-6">
            <GPS51EmergencyControlPanel />
            <GPS51EmergencyRecoveryPanel />
          </div>
        </TabsContent>

        <TabsContent value="scheduler">
          <GPS51CronJobManager />
        </TabsContent>

        <TabsContent value="maps">
          <MaptilerSettingsPanel />
        </TabsContent>

        <TabsContent value="debug">
          <div className="space-y-6">
            <GPS51ProductionReadinessPanel />
            <GPS51AuthDiagnosticsPanel />
            <GPS51SupabaseSecretsTest />
            <GPS51RealTimeTestPanel />
            <GPS51OfflineDeviceDiagnostics />
            <GPS51DeviceRecoveryTool />
            <GPS51DebugPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
