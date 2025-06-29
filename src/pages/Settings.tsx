import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GPS51CredentialsForm } from '@/components/settings/GPS51CredentialsForm';
import { GPS51DebugPanel } from '@/components/settings/GPS51DebugPanel';
import { Settings as SettingsIcon, Database, Bell, Shield } from 'lucide-react';

const Settings = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <div className="grid gap-8">
        <GPS51CredentialsForm />
        <GPS51DebugPanel />
      </div>
    </div>
  );
};

export default Settings;
