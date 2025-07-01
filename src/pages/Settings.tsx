
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Satellite, Bell, Shield } from 'lucide-react';
import { GPS51CredentialsForm } from '@/components/settings/GPS51CredentialsForm';

const Settings = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
      </div>

      <Tabs defaultValue="gps51" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="gps51" className="flex items-center gap-2">
            <Satellite className="h-4 w-4" />
            GPS51 API
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="gps51" className="mt-6">
          <GPS51CredentialsForm />
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Notification settings will be configured here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Security settings will be configured here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">General application settings will be configured here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
