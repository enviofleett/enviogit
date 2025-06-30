
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GPS51CredentialsForm } from '@/components/settings/GPS51CredentialsForm';
import { GPS51DebugPanel } from '@/components/settings/GPS51DebugPanel';
import { GPS51BatchSyncPanel } from '@/components/settings/GPS51BatchSyncPanel';
import { GPS51CronJobManager } from '@/components/settings/GPS51CronJobManager';
import GPS51DeviceManager from '@/components/settings/GPS51DeviceManager';
import { Settings as SettingsIcon, Database, Bell, Shield, Zap, Clock, Monitor } from 'lucide-react';
import ScalingMonitorPanel from '@/components/settings/ScalingMonitorPanel';

const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GPS51 Integration Settings</h1>
        <p className="text-muted-foreground">
          Configure your GPS51 integration, manage sync jobs, and monitor system performance.
        </p>
      </div>

      <Tabs defaultValue="credentials" className="space-y-6">
        <TabsList>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
          <TabsTrigger value="batch">Batch Sync</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="scaling">Scaling</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="credentials">
          <GPS51CredentialsForm />
        </TabsContent>

        <TabsContent value="devices">
          <GPS51DeviceManager />
        </TabsContent>

        <TabsContent value="debug">
          <GPS51DebugPanel />
        </TabsContent>

        <TabsContent value="batch">
          <GPS51BatchSyncPanel />
        </TabsContent>

        <TabsContent value="scheduler">
          <GPS51CronJobManager />
        </TabsContent>

        <TabsContent value="scaling">
          <ScalingMonitorPanel />
        </TabsContent>

        <TabsContent value="notifications">
          <div className="text-center text-muted-foreground py-12">
            <p>Notification settings will be implemented in Phase 4</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
