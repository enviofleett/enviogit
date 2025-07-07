
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
import { GPS51HealthDashboard } from '@/components/monitoring/GPS51HealthDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Mail, Smartphone, Package, Activity, Shield, Key, Store, Lock, Users, Brain, AlertTriangle } from 'lucide-react';
import { AIChatbotSettings } from '@/components/settings/AIChatbotSettings';
import { GPS51EmergencyControls } from '@/components/settings/GPS51EmergencyControls';
import { GPS51OptimizationStatus } from '@/components/settings/GPS51OptimizationStatus';
import { GPS51ProductionValidator } from '@/components/settings/GPS51ProductionValidator/GPS51ProductionValidator';

const Settings = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your fleet management system</p>
      </div>
      
      <Tabs defaultValue="emergency" className="space-y-6">
        <div className="flex flex-col space-y-2">
          <TabsList className="grid w-full grid-cols-6 lg:grid-cols-7">
            <TabsTrigger value="emergency" className="flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="hidden sm:inline">EMERGENCY</span>
              <span className="sm:hidden">EMG</span>
            </TabsTrigger>
            <TabsTrigger value="gps51-health" className="flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">GPS51 Health</span>
              <span className="sm:hidden">Health</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-1 text-xs">
              <Activity className="h-3 w-3" />
              <span className="hidden sm:inline">Monitor</span>
              <span className="sm:hidden">Mon</span>
            </TabsTrigger>
            <TabsTrigger value="readiness" className="flex items-center gap-1 text-xs">
              <Shield className="h-3 w-3" />
              <span className="hidden sm:inline">Readiness</span>
              <span className="sm:hidden">Ready</span>
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="flex items-center gap-1 text-xs">
              <Store className="h-3 w-3" />
              <span className="hidden sm:inline">Marketplace</span>
              <span className="sm:hidden">Store</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1 text-xs">
              <Lock className="h-3 w-3" />
              <span className="hidden sm:inline">Security</span>
              <span className="sm:hidden">Sec</span>
            </TabsTrigger>
            <TabsTrigger value="gps51" className="flex items-center gap-1 text-xs lg:hidden">
              <SettingsIcon className="h-3 w-3" />
              <span className="hidden sm:inline">GPS51</span>
              <span className="sm:hidden">GPS</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="mobile" className="flex items-center gap-1 text-xs">
              <Smartphone className="h-3 w-3" />
              <span className="hidden sm:inline">Mobile</span>
              <span className="sm:hidden">Mob</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-1 text-xs">
              <Package className="h-3 w-3" />
              <span className="hidden sm:inline">Subscriptions</span>
              <span className="sm:hidden">Subs</span>
            </TabsTrigger>
            <TabsTrigger value="credentials" className="flex items-center gap-1 text-xs">
              <Key className="h-3 w-3" />
              <span className="hidden sm:inline">API Keys</span>
              <span className="sm:hidden">API</span>
            </TabsTrigger>
            <TabsTrigger value="gps51" className="hidden lg:flex items-center gap-1 text-xs">
              <SettingsIcon className="h-3 w-3" />
              <span>GPS51</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-1 text-xs">
              <Mail className="h-3 w-3" />
              <span className="hidden sm:inline">Email</span>
              <span className="sm:hidden">Mail</span>
            </TabsTrigger>
            <TabsTrigger value="partners" className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">Partners</span>
              <span className="sm:hidden">Part</span>
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="flex items-center gap-1 text-xs">
              <Brain className="h-3 w-3" />
              <span className="hidden sm:inline">AI Chatbot</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="emergency">
          <div className="space-y-6">
            <GPS51OptimizationStatus />
            <GPS51ProductionValidator />
            <GPS51EmergencyControls />
          </div>
        </TabsContent>
        
        <TabsContent value="gps51-health">
          <GPS51HealthDashboard />
        </TabsContent>
        
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
