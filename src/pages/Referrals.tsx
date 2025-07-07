import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReferralDashboard } from '@/components/referrals/ReferralDashboard';
import { ReferralAgentManagement } from '@/components/referrals/ReferralAgentManagement';
import { ReferralCommissionTracking } from '@/components/referrals/ReferralCommissionTracking';
import { ReferralPayoutManagement } from '@/components/referrals/ReferralPayoutManagement';
import { ReferralSettings } from '@/components/referrals/ReferralSettings';
import { 
  BarChart3,
  Users, 
  DollarSign, 
  CreditCard,
  Settings
} from 'lucide-react';

const Referrals = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Referral Program</h1>
        <p className="text-muted-foreground">
          Comprehensive management system for referral agents, commissions, and payouts
        </p>
      </div>
      
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Commissions
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payouts
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <ReferralDashboard />
        </TabsContent>
        
        <TabsContent value="agents">
          <ReferralAgentManagement />
        </TabsContent>
        
        <TabsContent value="commissions">
          <ReferralCommissionTracking />
        </TabsContent>
        
        <TabsContent value="payouts">
          <ReferralPayoutManagement />
        </TabsContent>
        
        <TabsContent value="settings">
          <ReferralSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Referrals;