import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Cog, 
  Plus, 
  Edit, 
  Trash2, 
  MessageSquare,
  DollarSign,
  Smartphone,
  Settings,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DeviceType {
  id: string;
  name: string;
  description: string;
  activation_fee_amount: number;
  configuration_sms_template: string;
  is_active: boolean;
  created_at: string;
}

interface CommissionRate {
  id: string;
  subscription_package_id: string;
  activation_commission_percentage: number;
  renewal_commission_percentage: number;
  upgrade_commission_percentage: number;
  is_active: boolean;
  subscription_packages?: {
    name: string;
    description: string;
  };
}

export const DeviceConfiguration = () => {
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([]);
  const [subscriptionPackages, setSubscriptionPackages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceType | null>(null);
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfigurationData();
  }, []);

  const loadConfigurationData = async () => {
    try {
      setIsLoading(true);
      
      const [deviceTypesData, commissionRatesData, packagesData] = await Promise.all([
        supabase.from('device_types').select('*').order('name'),
        supabase.from('commission_rates').select(`
          *,
          subscription_packages (
            name,
            description
          )
        `).order('created_at'),
        supabase.from('subscription_packages').select('*').eq('is_active', true)
      ]);

      if (deviceTypesData.error) throw deviceTypesData.error;
      if (commissionRatesData.error) throw commissionRatesData.error;
      if (packagesData.error) throw packagesData.error;

      setDeviceTypes(deviceTypesData.data || []);
      setCommissionRates(commissionRatesData.data || []);
      setSubscriptionPackages(packagesData.data || []);
    } catch (error) {
      console.error('Error loading configuration data:', error);
      toast({
        title: "Error",
        description: "Failed to load configuration data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveDeviceType = async (deviceData: Partial<DeviceType> & { name: string; configuration_sms_template: string }) => {
    try {
      let result;
      
      if (deviceData.id) {
        // Update existing device type
        result = await supabase
          .from('device_types')
          .update(deviceData)
          .eq('id', deviceData.id)
          .select()
          .single();
      } else {
        // Create new device type
        result = await supabase
          .from('device_types')
          .insert(deviceData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: `Device type ${deviceData.id ? 'updated' : 'created'} successfully`,
      });

      loadConfigurationData();
      setIsDeviceDialogOpen(false);
      setSelectedDevice(null);
    } catch (error) {
      console.error('Error saving device type:', error);
      toast({
        title: "Error",
        description: "Failed to save device type",
        variant: "destructive",
      });
    }
  };

  const toggleDeviceStatus = async (deviceId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('device_types')
        .update({ is_active: isActive })
        .eq('id', deviceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Device type ${isActive ? 'activated' : 'deactivated'}`,
      });

      loadConfigurationData();
    } catch (error) {
      console.error('Error updating device status:', error);
      toast({
        title: "Error",
        description: "Failed to update device status",
        variant: "destructive",
      });
    }
  };

  const updateCommissionRate = async (rateId: string, updates: Partial<CommissionRate>) => {
    try {
      const { error } = await supabase
        .from('commission_rates')
        .update(updates)
        .eq('id', rateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Commission rate updated successfully",
      });

      loadConfigurationData();
    } catch (error) {
      console.error('Error updating commission rate:', error);
      toast({
        title: "Error",
        description: "Failed to update commission rate",
        variant: "destructive",
      });
    }
  };

  const DeviceTypeCard = ({ device }: { device: DeviceType }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{device.name}</h3>
            <p className="text-sm text-muted-foreground mb-2">{device.description}</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="h-3 w-3" />
                <span>Activation Fee: ₦{device.activation_fee_amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3" />
                <span>SMS Template Configured</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge variant={device.is_active ? "default" : "secondary"}>
              {device.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Switch
              checked={device.is_active}
              onCheckedChange={(checked) => toggleDeviceStatus(device.id, checked)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              setSelectedDevice(device);
              setIsDeviceDialogOpen(true);
            }}
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <MessageSquare className="h-3 w-3 mr-1" />
                SMS Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>SMS Template: {device.name}</DialogTitle>
              </DialogHeader>
              <SMSTemplateView template={device.configuration_sms_template} />
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );

  const DeviceTypeForm = ({ device, onSave }: { device?: DeviceType | null, onSave: (data: Partial<DeviceType>) => void }) => {
    const [formData, setFormData] = useState({
      name: device?.name || '',
      description: device?.description || '',
      activation_fee_amount: device?.activation_fee_amount || 0,
      configuration_sms_template: device?.configuration_sms_template || '',
      is_active: device?.is_active ?? true
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave({
        ...formData,
        ...(device?.id && { id: device.id })
      });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Device Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., OBD Tracker"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Activation Fee (₦)</label>
            <Input
              type="number"
              value={formData.activation_fee_amount}
              onChange={(e) => setFormData({ ...formData, activation_fee_amount: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Description</label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the device type"
          />
        </div>

        <div>
          <label className="text-sm font-medium">SMS Configuration Template</label>
          <Textarea
            value={formData.configuration_sms_template}
            onChange={(e) => setFormData({ ...formData, configuration_sms_template: e.target.value })}
            placeholder="Enter SMS template with placeholders like {IMEI}, {SIM_NUMBER}, etc."
            rows={4}
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use placeholders: {'{IMEI}'}, {'{SIM_NUMBER}'}, {'{GSM_NETWORK}'}, {'{APN}'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <label className="text-sm font-medium">Active</label>
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => setIsDeviceDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="submit">
            {device?.id ? 'Update' : 'Create'} Device Type
          </Button>
        </div>
      </form>
    );
  };

  const SMSTemplateView = ({ template }: { template: string }) => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Template Content</label>
        <div className="mt-2 p-3 bg-muted rounded border">
          <pre className="text-sm whitespace-pre-wrap">{template}</pre>
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium">Available Placeholders</label>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-muted rounded">
            <code>{'{IMEI}'}</code> - Device IMEI number
          </div>
          <div className="p-2 bg-muted rounded">
            <code>{'{SIM_NUMBER}'}</code> - SIM card number
          </div>
          <div className="p-2 bg-muted rounded">
            <code>{'{GSM_NETWORK}'}</code> - Network provider
          </div>
          <div className="p-2 bg-muted rounded">
            <code>{'{APN}'}</code> - Access Point Name
          </div>
        </div>
      </div>
    </div>
  );

  const CommissionRateCard = ({ rate }: { rate: CommissionRate }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold">{rate.subscription_packages?.name || 'Package'}</h3>
            <p className="text-sm text-muted-foreground">{rate.subscription_packages?.description}</p>
          </div>
          <Badge variant={rate.is_active ? "default" : "secondary"}>
            {rate.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <label className="font-medium">Activation</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={rate.activation_commission_percentage}
                onChange={(e) => updateCommissionRate(rate.id, { 
                  activation_commission_percentage: parseFloat(e.target.value) || 0 
                })}
                className="h-8"
                min="0"
                max="100"
                step="0.1"
              />
              <span>%</span>
            </div>
          </div>
          
          <div>
            <label className="font-medium">Renewal</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={rate.renewal_commission_percentage}
                onChange={(e) => updateCommissionRate(rate.id, { 
                  renewal_commission_percentage: parseFloat(e.target.value) || 0 
                })}
                className="h-8"
                min="0"
                max="100"
                step="0.1"
              />
              <span>%</span>
            </div>
          </div>
          
          <div>
            <label className="font-medium">Upgrade</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={rate.upgrade_commission_percentage}
                onChange={(e) => updateCommissionRate(rate.id, { 
                  upgrade_commission_percentage: parseFloat(e.target.value) || 0 
                })}
                className="h-8"
                min="0"
                max="100"
                step="0.1"
              />
              <span>%</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Switch
            checked={rate.is_active}
            onCheckedChange={(checked) => updateCommissionRate(rate.id, { is_active: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="devices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="devices">Device Types</TabsTrigger>
          <TabsTrigger value="commissions">Commission Rates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cog className="h-5 w-5" />
                  Device Type Management
                </div>
                <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedDevice(null)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Device Type
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {selectedDevice ? 'Edit Device Type' : 'Create New Device Type'}
                      </DialogTitle>
                    </DialogHeader>
                    <DeviceTypeForm device={selectedDevice} onSave={saveDeviceType} />
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deviceTypes.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No device types configured. Create your first device type to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {deviceTypes.map((device) => (
                    <DeviceTypeCard key={device.id} device={device} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Commission Rate Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {commissionRates.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No commission rates configured. Commission rates are automatically created for subscription packages.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {commissionRates.map((rate) => (
                    <CommissionRateCard key={rate.id} rate={rate} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};