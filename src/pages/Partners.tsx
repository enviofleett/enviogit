import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PartnerDashboard } from '@/components/partners/PartnerDashboard';
import { PartnerManagement } from '@/components/partners/PartnerManagement';
import { FinancialManagement } from '@/components/partners/FinancialManagement';
import { DeviceConfiguration } from '@/components/partners/DeviceConfiguration';
import { SupportMonitoring } from '@/components/partners/SupportMonitoring';
import { PartnerSettings } from '@/components/partners/PartnerSettings';
import { 
  Users, 
  DollarSign, 
  Settings, 
  Monitor, 
  BarChart3,
  Cog
} from 'lucide-react';

const Partners = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Technical Partner Management</h1>
        <p className="text-muted-foreground">
          Comprehensive management system for technical partners, devices, and services
        </p>
      </div>
      
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="partners" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Cog className="h-4 w-4" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Support
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <PartnerDashboard />
        </TabsContent>
        
        <TabsContent value="partners">
          <PartnerManagement />
        </TabsContent>
        
        <TabsContent value="financial">
          <FinancialManagement />
        </TabsContent>
        
        <TabsContent value="devices">
          <DeviceConfiguration />
        </TabsContent>
        
        <TabsContent value="support">
          <SupportMonitoring />
        </TabsContent>
        
        <TabsContent value="settings">
          <PartnerSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Partners;