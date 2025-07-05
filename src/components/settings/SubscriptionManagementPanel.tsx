import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Package, DollarSign, Clock, Users, Settings, Trash2, Edit3 } from 'lucide-react';

interface SubscriptionPackage {
  id: string;
  name: string;
  description: string;
  price_quarterly: number;
  price_annually: number;
  trial_days: number;
  features: string[];
  is_active: boolean;
}

export function SubscriptionManagementPanel() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingPackage, setEditingPackage] = useState<SubscriptionPackage | null>(null);
  const { toast } = useToast();

  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    price_quarterly: 0,
    price_annually: 0,
    trial_days: 7,
    features: [] as string[]
  });

  const availableFeatures = [
    'real_time_tracking',
    'basic_history',
    'full_history',
    'vehicle_status',
    'engine_control',
    'geofencing',
    'alerts',
    'live_video',
    'advanced_analytics',
    'api_access'
  ];

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_packages')
        .select('*')
        .order('price_quarterly', { ascending: true });

      if (error) throw error;
      
      // Type conversion for features field
      const packagesData = (data || []).map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description || '',
        price_quarterly: pkg.price_quarterly || 0,
        price_annually: pkg.price_annually || 0,
        trial_days: pkg.trial_days || 7,
        features: Array.isArray(pkg.features) ? pkg.features.filter((f): f is string => typeof f === 'string') : [],
        is_active: pkg.is_active ?? true
      }));
      
      setPackages(packagesData);
    } catch (error: any) {
      toast({ 
        title: "Load Error", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const savePackage = async () => {
    setIsLoading(true);
    try {
      const packageData = {
        ...packageForm,
        features: packageForm.features
      };

      if (editingPackage) {
        const { error } = await supabase
          .from('subscription_packages')
          .update(packageData)
          .eq('id', editingPackage.id);

        if (error) throw error;
        toast({ title: "Package Updated", description: "Subscription package updated successfully" });
      } else {
        const { error } = await supabase
          .from('subscription_packages')
          .insert(packageData);

        if (error) throw error;
        toast({ title: "Package Created", description: "New subscription package created successfully" });
      }

      setPackageForm({
        name: '',
        description: '',
        price_quarterly: 0,
        price_annually: 0,
        trial_days: 7,
        features: []
      });
      setEditingPackage(null);
      loadPackages();
    } catch (error: any) {
      toast({ 
        title: "Save Error", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const editPackage = (pkg: SubscriptionPackage) => {
    setEditingPackage(pkg);
    setPackageForm({
      name: pkg.name,
      description: pkg.description || '',
      price_quarterly: pkg.price_quarterly || 0,
      price_annually: pkg.price_annually || 0,
      trial_days: pkg.trial_days,
      features: pkg.features
    });
  };

  const togglePackageStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('subscription_packages')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;
      
      toast({ 
        title: "Package Status Updated", 
        description: `Package ${!isActive ? 'activated' : 'deactivated'}` 
      });
      loadPackages();
    } catch (error: any) {
      toast({ 
        title: "Update Error", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const toggleFeature = (feature: string) => {
    setPackageForm(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Subscription Package Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Create and manage subscription tiers for your mobile fleet management system.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Package Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {editingPackage ? 'Edit Package' : 'Create New Package'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Package Name</Label>
                  <Input
                    value={packageForm.name}
                    onChange={(e) => setPackageForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Basic, Premium, Enterprise"
                  />
                </div>
                <div>
                  <Label>Trial Days</Label>
                  <Input
                    type="number"
                    value={packageForm.trial_days}
                    onChange={(e) => setPackageForm(prev => ({ ...prev, trial_days: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Quarterly Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={packageForm.price_quarterly}
                    onChange={(e) => setPackageForm(prev => ({ ...prev, price_quarterly: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Annual Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={packageForm.price_annually}
                    onChange={(e) => setPackageForm(prev => ({ ...prev, price_annually: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              
              <div>
                <Label>Description</Label>
                <Textarea
                  value={packageForm.description}
                  onChange={(e) => setPackageForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Package description..."
                />
              </div>

              <div>
                <Label>Features</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {availableFeatures.map(feature => (
                    <Button
                      key={feature}
                      variant={packageForm.features.includes(feature) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleFeature(feature)}
                      className="justify-start text-xs h-8"
                    >
                      {feature.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={savePackage} disabled={isLoading || !packageForm.name}>
                  {isLoading ? "Saving..." : editingPackage ? "Update Package" : "Create Package"}
                </Button>
                {editingPackage && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditingPackage(null);
                      setPackageForm({ name: '', description: '', price_quarterly: 0, price_annually: 0, trial_days: 7, features: [] });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Existing Packages */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Existing Packages</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map(pkg => (
                <Card key={pkg.id} className={!pkg.is_active ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      <Badge variant={pkg.is_active ? "default" : "secondary"}>
                        {pkg.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4" />
                      <span>${pkg.price_quarterly}/quarter • ${pkg.price_annually}/year</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>{pkg.trial_days} day trial</span>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Features ({pkg.features.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {pkg.features.slice(0, 3).map(feature => (
                          <Badge key={feature} variant="outline" className="text-xs">
                            {feature.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {pkg.features.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{pkg.features.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editPackage(pkg)}
                        className="flex-1"
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={pkg.is_active ? "secondary" : "default"}
                        onClick={() => togglePackageStatus(pkg.id, pkg.is_active)}
                      >
                        {pkg.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
