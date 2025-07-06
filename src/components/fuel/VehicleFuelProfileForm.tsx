import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { manufacturerDataService } from '@/services/fuel/ManufacturerDataService';
import { Car, Search, Plus } from 'lucide-react';

interface VehicleFuelProfileFormProps {
  vehicleId: string;
  onSaved?: () => void;
}

export function VehicleFuelProfileForm({ vehicleId, onSaved }: VehicleFuelProfileFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: '',
    engineSize: '',
    engineType: '',
    fuelType: 'petrol',
    transmissionType: '',
    fuelCapacity: '',
    fuelPrice: '1.50',
    efficiencyTarget: ''
  });

  const [existingProfile, setExistingProfile] = useState<any>(null);

  useEffect(() => {
    loadBrands();
    loadExistingProfile();
  }, [vehicleId]);

  useEffect(() => {
    if (formData.brand) {
      loadModelsForBrand(formData.brand);
    }
  }, [formData.brand]);

  useEffect(() => {
    if (formData.brand && formData.model) {
      loadYearsForModel(formData.brand, formData.model);
    }
  }, [formData.brand, formData.model]);

  const loadBrands = async () => {
    try {
      const brandList = await manufacturerDataService.getAllBrands();
      setBrands(brandList);
    } catch (error) {
      console.error('Failed to load brands:', error);
    }
  };

  const loadModelsForBrand = async (brand: string) => {
    try {
      const modelList = await manufacturerDataService.getModelsForBrand(brand);
      setModels(modelList);
      setFormData(prev => ({ ...prev, model: '', year: '' }));
      setYears([]);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const loadYearsForModel = async (brand: string, model: string) => {
    try {
      const yearList = await manufacturerDataService.getYearsForModel(brand, model);
      setYears(yearList);
      setFormData(prev => ({ ...prev, year: '' }));
    } catch (error) {
      console.error('Failed to load years:', error);
    }
  };

  const loadExistingProfile = async () => {
    try {
      setLoading(true);
      
      // Load existing vehicle data
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single();

      // Load existing fuel profile
      const { data: profile } = await supabase
        .from('vehicle_fuel_profiles')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .single();

      if (vehicle) {
        setFormData(prev => ({
          ...prev,
          brand: vehicle.make || '',
          model: vehicle.model || '',
          year: vehicle.year?.toString() || ''
        }));
      }

      if (profile) {
        setExistingProfile(profile);
        setFormData(prev => ({
          ...prev,
          fuelCapacity: profile.custom_fuel_capacity?.toString() || '',
          fuelPrice: profile.preferred_fuel_price?.toString() || '1.50',
          efficiencyTarget: profile.efficiency_target?.toString() || ''
        }));
      }
    } catch (error) {
      console.error('Failed to load existing profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First, update the vehicle with enhanced manufacturer data
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({
          make: formData.brand,
          model: formData.model,
          year: formData.year ? parseInt(formData.year) : null
        })
        .eq('id', vehicleId);

      if (vehicleError) throw vehicleError;

      // Find matching manufacturer data
      let manufacturerDataId = null;
      if (formData.brand && formData.model && formData.year) {
        const match = await manufacturerDataService.getExactVehicleMatch(
          formData.brand,
          formData.model,
          parseInt(formData.year)
        );
        manufacturerDataId = match?.id || null;
      }

      // Create or update fuel profile
      const profileData = {
        vehicle_id: vehicleId,
        user_id: user.id,
        manufacturer_data_id: manufacturerDataId,
        custom_fuel_capacity: formData.fuelCapacity ? parseFloat(formData.fuelCapacity) : null,
        preferred_fuel_price: formData.fuelPrice ? parseFloat(formData.fuelPrice) : 1.50,
        efficiency_target: formData.efficiencyTarget ? parseFloat(formData.efficiencyTarget) : null
      };

      const { error: profileError } = await supabase
        .from('vehicle_fuel_profiles')
        .upsert(profileData, {
          onConflict: 'vehicle_id'
        });

      if (profileError) throw profileError;

      toast({
        title: "Profile Saved",
        description: "Vehicle fuel profile has been updated successfully"
      });

      onSaved?.();
    } catch (error: any) {
      console.error('Failed to save fuel profile:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save fuel profile",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Car className="h-8 w-8 mx-auto mb-4 animate-pulse" />
            <p>Loading vehicle profile...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          Enhanced Vehicle Profile
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete your vehicle details to enable advanced fuel consumption analysis
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Manufacturer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Manufacturer Information</h3>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand *</Label>
                <Select value={formData.brand} onValueChange={(value) => setFormData(prev => ({ ...prev, brand: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(brand => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Select 
                  value={formData.model} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}
                  disabled={!formData.brand}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(model => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Select 
                  value={formData.year} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, year: value }))}
                  disabled={!formData.model}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Engine & Fuel Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Engine & Fuel Information</h3>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="engineSize">Engine Size</Label>
                <Input
                  id="engineSize"
                  placeholder="e.g., 2.0L"
                  value={formData.engineSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, engineSize: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="engineType">Engine Type</Label>
                <Select value={formData.engineType} onValueChange={(value) => setFormData(prev => ({ ...prev, engineType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="naturally_aspirated">Naturally Aspirated</SelectItem>
                    <SelectItem value="turbocharged">Turbocharged</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuelType">Fuel Type</Label>
                <Select value={formData.fuelType} onValueChange={(value) => setFormData(prev => ({ ...prev, fuelType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="petrol">Petrol</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Fuel Management */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Fuel Management</h3>
            
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fuelCapacity">Fuel Tank Capacity (L)</Label>
                <Input
                  id="fuelCapacity"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 50.0"
                  value={formData.fuelCapacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, fuelCapacity: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuelPrice">Preferred Fuel Price ($/L)</Label>
                <Input
                  id="fuelPrice"
                  type="number"
                  step="0.01"
                  placeholder="1.50"
                  value={formData.fuelPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, fuelPrice: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="efficiencyTarget">Efficiency Target (L/100km)</Label>
                <Input
                  id="efficiencyTarget"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 7.5"
                  value={formData.efficiencyTarget}
                  onChange={(e) => setFormData(prev => ({ ...prev, efficiencyTarget: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={saving || !formData.brand || !formData.model || !formData.year}>
              {saving ? (
                <>
                  <Plus className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {existingProfile ? 'Update Profile' : 'Create Profile'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}