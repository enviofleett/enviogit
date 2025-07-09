
import React, { useState, useEffect } from 'react';
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
import { GPS51APITester } from '../debug/GPS51APITester';
import { GPS51HealthStatus } from './GPS51HealthStatus';
import { GPS51PermissionDiagnosticsPanel } from './GPS51PermissionDiagnosticsPanel';
import { GPS51AuthCredentials } from '@/services/gps51/GPS51Types';

interface GPS51SettingsProps {
  onCredentialsChange?: (credentials: any) => void;
}

export const GPS51Settings: React.FC<GPS51SettingsProps> = ({ onCredentialsChange }) => {
  const [credentials, setCredentials] = useState<GPS51AuthCredentials | null>(null);

  useEffect(() => {
    // Load saved credentials from localStorage - handle security-conscious storage format
    const loadCredentials = () => {
      try {
        // Try to load from individual localStorage keys first (current format)
        const username = localStorage.getItem('gps51_username');
        const passwordHash = localStorage.getItem('gps51_password_hash');
        const apiUrl = localStorage.getItem('gps51_api_url');
        const from = localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
        const type = localStorage.getItem('gps51_type') as 'USER' | 'DEVICE';

        if (username && passwordHash && apiUrl) {
          // Successfully loaded from individual keys
          const fullCredentials: GPS51AuthCredentials = {
            username,
            password: passwordHash, // This is already hashed
            apiUrl,
            from: from || 'WEB',
            type: type || 'USER'
          };
          setCredentials(fullCredentials);
          console.log('GPS51Settings: Loaded credentials from individual localStorage keys');
          return;
        }

        // Fallback: try to load from JSON format (legacy)
        const savedCredentials = localStorage.getItem('gps51_credentials');
        if (savedCredentials) {
          const parsed = JSON.parse(savedCredentials);
          
          // Note: JSON format doesn't include password for security
          // Only set if we have at least username and apiUrl
          if (parsed.username && parsed.apiUrl) {
            const partialCredentials: GPS51AuthCredentials = {
              username: parsed.username,
              password: '', // Will be empty - component should handle this
              apiUrl: parsed.apiUrl,
              from: parsed.from || 'WEB',
              type: parsed.type || 'USER'
            };
            setCredentials(partialCredentials);
            console.log('GPS51Settings: Loaded partial credentials from JSON format');
          }
        }
      } catch (error) {
        console.error('GPS51Settings: Failed to load credentials:', error);
      }
    };

    loadCredentials();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">GPS51 Integration</h2>
        <p className="text-slate-600">
          Configure and manage your GPS51 platform integration for real-time vehicle tracking.
        </p>
      </div>

      <Tabs defaultValue="emergency" className="space-y-6">
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
          <TabsTrigger value="activation">Real-Time</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="api-tester">API Tester</TabsTrigger>
          <TabsTrigger value="debug">Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <GPS51HealthStatus />
        </TabsContent>

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

        <TabsContent value="permissions">
          <GPS51PermissionDiagnosticsPanel credentials={credentials} />
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

        <TabsContent value="api-tester">
          <GPS51APITester />
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
