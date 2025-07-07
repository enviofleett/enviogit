
import React from 'react';
import { GPS51Settings } from '@/components/settings/GPS51Settings';
import { EmailConfigurationPanel } from '@/components/settings/EmailConfigurationPanel';
import { MobileUserManagementPanel } from '@/components/settings/MobileUserManagementPanel';
import { SubscriptionManagementPanel } from '@/components/settings/SubscriptionManagementPanel';
import { APICredentialsPanel } from '@/components/settings/APICredentialsPanel';
import { PINManagement } from '@/components/settings/PINManagement';
import { SuperAdminSetup } from '@/components/settings/SuperAdminSetup';
import { ProductionDashboard } from '@/components/monitoring/ProductionDashboard';
import { ProductionReadinessDashboard } from '@/components/monitoring/ProductionReadinessDashboard';
import { MarketplaceAdminPanel } from '@/components/marketplace/MarketplaceAdminPanel';
import { TechnicalPartnerAdminPanel } from '@/components/settings/TechnicalPartnerAdminPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Mail, Smartphone, Package, Activity, Shield, Key, Store, Lock, Users, Brain } from 'lucide-react';
import { AIChatbotSettings } from '@/components/settings/AIChatbotSettings';

const Settings = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your fleet management system</p>
      </div>
      
      <Tabs defaultValue="monitoring" className="space-y-6">
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="readiness" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Readiness
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            Marketplace
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="mobile" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Mobile
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="credentials" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="gps51" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            GPS51
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="partners" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="chatbot" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Chatbot
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="monitoring">
          <ProductionDashboard />
        </TabsContent>
        
        <TabsContent value="readiness">
          <ProductionReadinessDashboard />
        </TabsContent>
        
        <TabsContent value="marketplace">
          <MarketplaceAdminPanel />
        </TabsContent>
        
        <TabsContent value="security">
          <div className="space-y-6">
            <SuperAdminSetup />
            <PINManagement />
          </div>
        </TabsContent>
        
        <TabsContent value="mobile">
          <MobileUserManagementPanel />
        </TabsContent>
        
        <TabsContent value="subscriptions">
          <SubscriptionManagementPanel />
        </TabsContent>
        
        <TabsContent value="credentials">
          <APICredentialsPanel />
        </TabsContent>
        
        <TabsContent value="gps51">
          <GPS51Settings />
        </TabsContent>
        
        <TabsContent value="email">
          <EmailConfigurationPanel />
        </TabsContent>
        
        <TabsContent value="partners">
          <TechnicalPartnerAdminPanel />
        </TabsContent>
        
        <TabsContent value="chatbot">
          <AIChatbotSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
