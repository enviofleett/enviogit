
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GPS51CredentialsForm } from '@/components/settings/GPS51CredentialsForm';
import { GPS51DebugPanel } from '@/components/settings/GPS51DebugPanel';
import { GPS51BatchSyncPanel } from '@/components/settings/GPS51BatchSyncPanel';
import { Settings as SettingsIcon, Database, Bell, Shield, Zap } from 'lucide-react';

const Settings = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <Tabs defaultValue="credentials" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="credentials" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="debug" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Debug
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Batch Sync
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials">
          <GPS51CredentialsForm />
        </TabsContent>

        <TabsContent value="debug">
          <GPS51DebugPanel />
        </TabsContent>

        <TabsContent value="batch">
          <GPS51BatchSyncPanel />
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure notification preferences and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Notification settings will be implemented in Phase 3
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
