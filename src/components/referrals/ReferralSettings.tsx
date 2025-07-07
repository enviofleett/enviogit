import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Settings, 
  Percent, 
  Save,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { ReferralCommissionService } from '@/services/referrals/ReferralCommissionService';
import { useToast } from '@/hooks/use-toast';

export const ReferralSettings = () => {
  const [commissionRates, setCommissionRates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedRates, setEditedRates] = useState<{[key: string]: number}>({});
  const { toast } = useToast();

  useEffect(() => {
    loadCommissionRates();
  }, []);

  const loadCommissionRates = async () => {
    try {
      setIsLoading(true);
      const rates = await ReferralCommissionService.getCommissionRates();
      setCommissionRates(rates);
      
      // Initialize edited rates with current values
      const initialRates: {[key: string]: number} = {};
      rates.forEach(rate => {
        initialRates[rate.commission_type] = rate.percentage;
      });
      setEditedRates(initialRates);
    } catch (error) {
      console.error('Error loading commission rates:', error);
      toast({
        title: "Error",
        description: "Failed to load commission rates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateChange = (commissionType: string, value: string) => {
    const percentage = parseFloat(value) || 0;
    if (percentage >= 0 && percentage <= 100) {
      setEditedRates(prev => ({
        ...prev,
        [commissionType]: percentage
      }));
    }
  };

  const handleSaveRates = async () => {
    try {
      setIsSaving(true);
      
      const ratesToUpdate = Object.entries(editedRates).map(([commission_type, percentage]) => ({
        commission_type,
        percentage
      }));
      
      await ReferralCommissionService.updateCommissionRates(ratesToUpdate);
      
      toast({
        title: "Success",
        description: "Commission rates updated successfully",
      });
      
      // Reload rates to get the updated values
      loadCommissionRates();
    } catch (error) {
      console.error('Error saving commission rates:', error);
      toast({
        title: "Error",
        description: "Failed to update commission rates",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = () => {
    return commissionRates.some(rate => 
      editedRates[rate.commission_type] !== rate.percentage
    );
  };

  const getCommissionTypeLabel = (type: string) => {
    switch (type) {
      case 'subscription_upgrade':
        return 'Subscription Upgrade';
      case 'marketplace_purchase':
        return 'Marketplace Purchase';
      default:
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getCommissionTypeDescription = (type: string) => {
    switch (type) {
      case 'subscription_upgrade':
        return 'Commission earned when a referred user upgrades their subscription package';
      case 'marketplace_purchase':
        return 'Commission earned when a referred user makes a marketplace purchase';
      default:
        return 'Commission earned for this type of referral event';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-10 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Referral Program Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Commission Rate Configuration</AlertTitle>
            <AlertDescription>
              These rates determine how much commission agents earn for different types of referral events. 
              Changes will apply to new commissions generated after saving.
            </AlertDescription>
          </Alert>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Commission Rates</h3>
              
              <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                {commissionRates.map((rate) => (
                  <Card key={rate.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {getCommissionTypeLabel(rate.commission_type)}
                        </CardTitle>
                        <Badge variant={rate.is_active ? "default" : "secondary"}>
                          {rate.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getCommissionTypeDescription(rate.commission_type)}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label htmlFor={`rate-${rate.commission_type}`}>
                              Commission Percentage
                            </Label>
                            <div className="relative mt-1">
                              <Input
                                id={`rate-${rate.commission_type}`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={editedRates[rate.commission_type] || 0}
                                onChange={(e) => handleRateChange(rate.commission_type, e.target.value)}
                                className="pr-8"
                              />
                              <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Current rate:</span>
                            <span className="font-medium">{rate.percentage}%</span>
                          </div>
                          {editedRates[rate.commission_type] !== rate.percentage && (
                            <div className="flex justify-between text-blue-600">
                              <span>New rate:</span>
                              <span className="font-medium">{editedRates[rate.commission_type]}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {hasChanges() && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Unsaved Changes</AlertTitle>
                <AlertDescription>
                  You have made changes to the commission rates. Don't forget to save your changes.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={loadCommissionRates}
                disabled={isSaving}
              >
                Reset Changes
              </Button>
              <Button
                onClick={handleSaveRates}
                disabled={!hasChanges() || isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Paystack Integration</Label>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Connected and operational</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Commission Processing</Label>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Automated processing enabled</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Payout Schedule</Label>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Manual approval required</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Email Notifications</Label>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Enabled for agents</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};