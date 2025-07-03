
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GPS51CredentialsForm } from './GPS51CredentialsForm';
import GPS51DeviceManager from './GPS51DeviceManager';
import { GPS51CronJobManager } from './GPS51CronJobManager';
import { GPS51RealTimeActivationPanel } from './GPS51RealTimeActivationPanel';
import { GPS51DebugPanel } from './GPS51DebugPanel';
import { GPS51RealTimeTestPanel } from './GPS51RealTimeTestPanel';
import { GPS51SupabaseSecretsTest } from './GPS51SupabaseSecretsTest';
import { GPS51BatchSyncPanel } from './GPS51BatchSyncPanel';

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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="activation">Real-Time</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="activation">
          <GPS51RealTimeActivationPanel />
        </TabsContent>

        <TabsContent value="credentials">
          <GPS51CredentialsForm />
        </TabsContent>

        <TabsContent value="devices">
          <GPS51DeviceManager />
        </TabsContent>

        <TabsContent value="sync">
          <GPS51BatchSyncPanel />
        </TabsContent>

        <TabsContent value="scheduler">
          <GPS51CronJobManager />
        </TabsContent>

        <TabsContent value="debug">
          <div className="space-y-6">
            <GPS51SupabaseSecretsTest />
            <GPS51RealTimeTestPanel />
            <GPS51DebugPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
