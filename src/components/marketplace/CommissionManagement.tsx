import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Percent, Settings, Save, RotateCcw } from 'lucide-react';
import type { ServiceCategory, MarketplaceConfiguration } from '@/types/marketplace';

export const CommissionManagement: React.FC = () => {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [globalSettings, setGlobalSettings] = useState<MarketplaceConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [categoriesRes, configRes] = await Promise.all([
        supabase.from('service_categories').select('*').order('name'),
        supabase.from('marketplace_configuration').select('*').eq('setting_key', 'global_commission_rate').single()
      ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (configRes.data) setGlobalSettings(configRes.data);
    } catch (error) {
      console.error('Error loading commission data:', error);
      toast({
        title: "Error",
        description: "Failed to load commission settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateCategoryCommission = async (categoryId: string, percentage: number) => {
    try {
      const { error } = await supabase
        .from('service_categories')
        .update({ commission_percentage: percentage })
        .eq('id', categoryId);

      if (error) throw error;

      setCategories(prev => 
        prev.map(cat => 
          cat.id === categoryId 
            ? { ...cat, commission_percentage: percentage }
            : cat
        )
      );

      toast({
        title: "Success",
        description: "Commission rate updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const updateGlobalCommission = async (percentage: number) => {
    if (!globalSettings) return;

    try {
      const { error } = await supabase
        .from('marketplace_configuration')
        .update({ 
          setting_value: { percentage },
          updated_at: new Date().toISOString()
        })
        .eq('id', globalSettings.id);

      if (error) throw error;

      setGlobalSettings(prev => prev ? {
        ...prev,
        setting_value: { percentage }
      } : null);

      toast({
        title: "Success",
        description: "Global commission rate updated successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const applyGlobalToAll = async () => {
    if (!globalSettings) return;

    setIsSaving(true);
    try {
      const globalRate = globalSettings.setting_value.percentage;
      
      const { error } = await supabase
        .from('service_categories')
        .update({ commission_percentage: globalRate })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

      if (error) throw error;

      setCategories(prev => 
        prev.map(cat => ({ ...cat, commission_percentage: globalRate }))
      );

      toast({
        title: "Success",
        description: `Applied ${globalRate}% commission to all categories`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading commission settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Commission Management
        </h3>
        <p className="text-muted-foreground">
          Configure commission rates for service categories and global settings
        </p>
      </div>

      {/* Global Commission Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Global Commission Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="global-rate">Default Commission Rate (%)</Label>
              <Input
                id="global-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={globalSettings?.setting_value?.percentage || 5}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value)) {
                    updateGlobalCommission(value);
                  }
                }}
                className="max-w-32"
              />
            </div>
            <Button
              onClick={applyGlobalToAll}
              disabled={isSaving}
              variant="outline"
              className="mt-6"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Apply to All Categories
            </Button>
          </div>
          <Alert>
            <AlertDescription>
              This rate will be applied to new categories by default. Use "Apply to All Categories" to update existing categories.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Category-Specific Commission Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Category-Specific Commission Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{category.name}</h4>
                  {category.description && (
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={category.is_active ? 'default' : 'secondary'}>
                    {category.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={category.commission_percentage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value)) {
                          updateCategoryCommission(category.id, value);
                        }
                      }}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Commission Analytics Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Impact Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {categories.reduce((sum, cat) => sum + cat.commission_percentage, 0) / categories.length || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Average Commission</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {Math.max(...categories.map(cat => cat.commission_percentage), 0)}%
              </div>
              <div className="text-sm text-muted-foreground">Highest Rate</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {Math.min(...categories.map(cat => cat.commission_percentage), 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Lowest Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};