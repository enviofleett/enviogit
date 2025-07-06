import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Car,
  Save,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit,
  Database
} from 'lucide-react';
import { manufacturerDataService, VehicleLookupResult } from '@/services/fuel/ManufacturerDataService';

interface Vehicle {
  id: string;
  make?: string;
  model?: string;
  year?: number;
  brand?: string;
  gps51_device_id: string;
  notes?: string;
}

interface VehicleProfileManagerProps {
  vehicleId?: string;
  onProfileUpdated?: (vehicle: Vehicle) => void;
}

export function VehicleProfileManager({ vehicleId, onProfileUpdated }: VehicleProfileManagerProps) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: '',
    engineSize: '',
    engineType: '',
    fuelType: 'petrol',
    transmissionType: '',
    licensePlate: '',
    fuelPrice: '1.50'
  });
  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<VehicleLookupResult[]>([]);
  const [selectedManufacturerData, setSelectedManufacturerData] = useState<VehicleLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchingManufacturer, setSearchingManufacturer] = useState(false);
  const [dataMatchConfidence, setDataMatchConfidence] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    if (vehicleId) {
      loadVehicle();
    }
  }, [vehicleId]);

  const loadVehicle = async () => {
    if (!vehicleId) return;

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;

      setVehicle(data);
      
      // Parse existing vehicle data
      const notes = data.notes ? JSON.parse(data.notes) : {};
      setFormData({
        brand: data.brand || data.make || '',
        model: data.model || '',
        year: data.year?.toString() || '',
        engineSize: notes.engine_details?.engine_size || '',
        engineType: notes.engine_details?.engine_type || '',
        fuelType: notes.engine_details?.fuel_type || data.type || 'petrol',
        transmissionType: notes.engine_details?.transmission_type || '',
        licensePlate: data.license_plate || data.plate || '',
        fuelPrice: '1.50'
      });

      // Auto-search for manufacturer data if we have brand/model/year
      if (data.brand && data.model && data.year) {
        searchManufacturerData(data.brand, data.model, data.year);
      }
    } catch (error) {
      console.error('Failed to load vehicle:', error);
      toast({
        title: "Error",
        description: "Failed to load vehicle profile",
        variant: "destructive"
      });
    }
  };

  const searchManufacturerData = async (brand?: string, model?: string, year?: number) => {
    setSearchingManufacturer(true);
    try {
      const searchBrand = brand || formData.brand;
      const searchModel = model || formData.model;
      const searchYear = year || parseInt(formData.year);

      if (!searchBrand || !searchModel || !searchYear) {
        setManufacturerSuggestions([]);
        return;
      }

      const suggestions = await manufacturerDataService.searchVehicleData(
        searchBrand, 
        searchModel, 
        searchYear, 
        5
      );

      setManufacturerSuggestions(suggestions);

      // Auto-select the best match if confidence is high
      if (suggestions.length > 0 && suggestions[0].matchConfidence > 0.8) {
        setSelectedManufacturerData(suggestions[0]);
        setDataMatchConfidence(suggestions[0].matchConfidence);
      }
    } catch (error) {
      console.error('Manufacturer data search failed:', error);
    } finally {
      setSearchingManufacturer(false);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Trigger manufacturer search when brand, model, or year changes
    if (['brand', 'model', 'year'].includes(field)) {
      const updatedData = { ...formData, [field]: value };
      if (updatedData.brand && updatedData.model && updatedData.year) {
        setTimeout(() => {
          searchManufacturerData(updatedData.brand, updatedData.model, parseInt(updatedData.year));
        }, 500);
      }
    }
  };

  const saveVehicleProfile = async () => {
    if (!vehicleId) return;

    setLoading(true);
    try {
      // Update vehicle record
      const updatedVehicle = {
        make: formData.brand,
        model: formData.model,
        year: parseInt(formData.year) || null,
        brand: formData.brand,
        type: formData.fuelType,
        license_plate: formData.licensePlate,
        plate: formData.licensePlate,
        notes: JSON.stringify({
          ...vehicle?.notes ? JSON.parse(vehicle.notes) : {},
          enhanced_profile: true,
          engine_details: {
            engine_size: formData.engineSize,
            engine_type: formData.engineType,
            fuel_type: formData.fuelType,
            transmission_type: formData.transmissionType
          },
          manufacturer_data_match: selectedManufacturerData ? {
            id: selectedManufacturerData.id,
            confidence: selectedManufacturerData.matchConfidence,
            matched_at: new Date().toISOString()
          } : null
        })
      };

      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update(updatedVehicle)
        .eq('id', vehicleId);

      if (vehicleError) throw vehicleError;

      // Create or update fuel profile
      const { error: profileError } = await supabase
        .from('vehicle_fuel_profiles')
        .upsert({
          vehicle_id: vehicleId,
          user_id: (await supabase.auth.getUser()).data.user?.id!,
          manufacturer_data_id: selectedManufacturerData?.id || null,
          preferred_fuel_price: parseFloat(formData.fuelPrice) || 1.50,
          efficiency_target: selectedManufacturerData?.combinedConsumption || null
        });

      if (profileError) throw profileError;

      toast({
        title: "Profile Updated",
        description: "Vehicle profile has been successfully updated with manufacturer data matching",
      });

      // Refresh vehicle data
      await loadVehicle();
      
      if (onProfileUpdated) {
        onProfileUpdated({ ...vehicle!, ...updatedVehicle });
      }
    } catch (error) {
      console.error('Failed to save vehicle profile:', error);
      toast({
        title: "Save Failed",
        description: "Failed to update vehicle profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Enhanced Vehicle Profile
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete your vehicle details to unlock intelligent fuel consumption insights
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Vehicle Information */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => handleFormChange('brand', e.target.value)}
                placeholder="e.g., Toyota, Honda, Ford"
              />
            </div>
            <div>
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleFormChange('model', e.target.value)}
                placeholder="e.g., Corolla, Civic, Escape"
              />
            </div>
            <div>
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => handleFormChange('year', e.target.value)}
                placeholder="e.g., 2023"
                min="1990"
                max={new Date().getFullYear() + 1}
              />
            </div>
          </div>

          {/* Engine Details */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="engineSize">Engine Size</Label>
              <Input
                id="engineSize"
                value={formData.engineSize}
                onChange={(e) => handleFormChange('engineSize', e.target.value)}
                placeholder="e.g., 2.0L, 1.6L"
              />
            </div>
            <div>
              <Label htmlFor="engineType">Engine Type</Label>
              <Select value={formData.engineType} onValueChange={(value) => handleFormChange('engineType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="naturally_aspirated">Naturally Aspirated</SelectItem>
                  <SelectItem value="turbocharged">Turbocharged</SelectItem>
                  <SelectItem value="supercharged">Supercharged</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fuelType">Fuel Type *</Label>
              <Select value={formData.fuelType} onValueChange={(value) => handleFormChange('fuelType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                  <SelectItem value="lpg">LPG</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="transmissionType">Transmission</Label>
              <Select value={formData.transmissionType} onValueChange={(value) => handleFormChange('transmissionType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transmission" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="cvt">CVT</SelectItem>
                  <SelectItem value="semi_automatic">Semi-Automatic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="licensePlate">License Plate</Label>
              <Input
                id="licensePlate"
                value={formData.licensePlate}
                onChange={(e) => handleFormChange('licensePlate', e.target.value)}
                placeholder="Enter license plate"
              />
            </div>
            <div>
              <Label htmlFor="fuelPrice">Preferred Fuel Price ($/L)</Label>
              <Input
                id="fuelPrice"
                type="number"
                step="0.01"
                value={formData.fuelPrice}
                onChange={(e) => handleFormChange('fuelPrice', e.target.value)}
                placeholder="1.50"
              />
            </div>
          </div>

          {/* Manufacturer Data Matching */}
          {(searchingManufacturer || manufacturerSuggestions.length > 0) && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4" />
                  Manufacturer Data Matching
                  {searchingManufacturer && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {manufacturerSuggestions.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Found {manufacturerSuggestions.length} matching manufacturer records:
                    </p>
                    {manufacturerSuggestions.map((suggestion) => (
                      <div 
                        key={suggestion.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedManufacturerData?.id === suggestion.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedManufacturerData(suggestion);
                          setDataMatchConfidence(suggestion.matchConfidence);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {suggestion.brand} {suggestion.model} ({suggestion.year})
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Combined: {suggestion.combinedConsumption.toFixed(1)} L/100km
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              suggestion.matchConfidence > 0.8 ? 'default' :
                              suggestion.matchConfidence > 0.6 ? 'secondary' : 'outline'
                            }>
                              {Math.round(suggestion.matchConfidence * 100)}% match
                            </Badge>
                            {selectedManufacturerData?.id === suggestion.id && (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchingManufacturer ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-muted-foreground">Searching manufacturer database...</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Data Match Status */}
          {selectedManufacturerData && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-sm">
                Manufacturer data matched with {Math.round(dataMatchConfidence * 100)}% confidence. 
                This enables advanced fuel consumption analysis.
              </span>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={saveVehicleProfile} disabled={loading} className="min-w-32">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}