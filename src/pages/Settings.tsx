
import { GPS51EmergencyControlPanel } from '@/components/settings/GPS51EmergencyControlPanel';
import { GPS51Settings } from '@/components/settings/GPS51Settings';
import { RLSSecurityAuditDashboard } from '@/components/security/RLSSecurityAuditDashboard';
import { SecurityPolicyGenerator } from '@/components/security/SecurityPolicyGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Settings = () => {
  return (
    <div className="container mx-auto p-6">
      <Tabs defaultValue="gps51" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="gps51">GPS51 Settings</TabsTrigger>
          <TabsTrigger value="security">Security Audit</TabsTrigger>
          <TabsTrigger value="policies">Policy Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="gps51">
          <GPS51Settings />
        </TabsContent>

        <TabsContent value="security">
          <RLSSecurityAuditDashboard />
        </TabsContent>

        <TabsContent value="policies">
          <SecurityPolicyGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
