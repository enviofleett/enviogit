import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Smartphone, 
  Car, 
  MapPin, 
  Battery, 
  Fuel, 
  Settings, 
  Play, 
  Square, 
  Lock, 
  Unlock,
  RefreshCw
} from 'lucide-react';

interface MobileAppState {
  user: any;
  vehicles: any[];
  selectedVehicle: any;
  dashboardData: any;
  isLoading: boolean;
}

export default function MobileApp() {
  const [state, setState] = useState<MobileAppState>({
    user: null,
    vehicles: [],
    selectedVehicle: null,
    dashboardData: null,
    isLoading: false
  });
  const { toast } = useToast();

  // Mock authentication for demo
  const mockAuth = {
    user: {
      id: 'demo-user-123',
      name: 'John Doe',
      email: 'john.doe@example.com'
    },
    gps51Token: 'demo-token-12345'
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('mobile-dashboard-data', {
        body: {
          userId: mockAuth.user.id,
          gps51Token: mockAuth.gps51Token,
          includePositions: true,
          includeAlerts: true
        }
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        user: mockAuth.user,
        dashboardData: data.data,
        vehicles: data.data.vehicles || [],
        selectedVehicle: data.data.vehicles?.[0] || null,
        isLoading: false
      }));

      toast({ title: "Dashboard Loaded", description: "✅ Mobile dashboard data loaded successfully" });
    } catch (error: any) {
      toast({ 
        title: "Load Error", 
        description: error.message, 
        variant: "destructive" 
      });
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const sendVehicleCommand = async (action: string) => {
    if (!state.selectedVehicle) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.functions.invoke('mobile-vehicle-control', {
        body: {
          userId: mockAuth.user.id,
          vehicleId: state.selectedVehicle.id,
          action,
          gps51Token: mockAuth.gps51Token
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({ 
          title: "Command Sent", 
          description: `${action.replace('_', ' ')} command executed successfully` 
        });
      } else {
        toast({ 
          title: "Command Failed", 
          description: data.error, 
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      toast({ 
        title: "Control Error", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/10">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Fleet Mobile</h1>
            </div>
            <Button size="sm" variant="outline" onClick={loadDashboard} disabled={state.isLoading}>
              <RefreshCw className={`h-4 w-4 ${state.isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* User Profile Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Welcome back!</CardTitle>
                <p className="text-sm text-muted-foreground">{state.user?.name || 'Loading...'}</p>
              </div>
              <Badge variant="outline">
                {state.dashboardData?.subscription?.package || 'Basic'}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Fleet Summary */}
        {state.dashboardData && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="text-center">
              <CardContent className="p-4">
                <Car className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-2xl font-bold">{state.dashboardData.summary.totalVehicles}</div>
                <div className="text-xs text-muted-foreground">Total Vehicles</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="h-8 w-8 mx-auto mb-2 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-white rounded-full"></div>
                </div>
                <div className="text-2xl font-bold text-green-600">{state.dashboardData.summary.activeVehicles}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-4">
                <div className="h-8 w-8 mx-auto mb-2 bg-gray-400 rounded-full flex items-center justify-center">
                  <div className="h-3 w-3 bg-white rounded-full"></div>
                </div>
                <div className="text-2xl font-bold text-gray-600">{state.dashboardData.summary.inactiveVehicles}</div>
                <div className="text-xs text-muted-foreground">Inactive</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Vehicle Selection */}
        {state.vehicles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Select Vehicle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {state.vehicles.map((vehicle: any) => (
                  <Button
                    key={vehicle.id}
                    variant={state.selectedVehicle?.id === vehicle.id ? "default" : "outline"}
                    className="justify-start h-auto p-3"
                    onClick={() => setState(prev => ({ ...prev, selectedVehicle: vehicle }))}
                  >
                    <div className="text-left">
                      <div className="font-medium">{vehicle.make || vehicle.gps51_device_id}</div>
                      <div className="text-xs opacity-70">{vehicle.gps51_device_id}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vehicle Controls */}
        {state.selectedVehicle && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Vehicle Controls
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Control your selected vehicle: {state.selectedVehicle.make || state.selectedVehicle.gps51_device_id}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col gap-2"
                  onClick={() => sendVehicleCommand('engine_start')}
                  disabled={state.isLoading}
                >
                  <Play className="h-6 w-6 text-green-600" />
                  <span className="text-sm">Start Engine</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col gap-2"
                  onClick={() => sendVehicleCommand('engine_stop')}
                  disabled={state.isLoading}
                >
                  <Square className="h-6 w-6 text-red-600" />
                  <span className="text-sm">Stop Engine</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col gap-2"
                  onClick={() => sendVehicleCommand('immobilizer_on')}
                  disabled={state.isLoading}
                >
                  <Lock className="h-6 w-6 text-orange-600" />
                  <span className="text-sm">Lock Vehicle</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto p-4 flex flex-col gap-2"
                  onClick={() => sendVehicleCommand('immobilizer_off')}
                  disabled={state.isLoading}
                >
                  <Unlock className="h-6 w-6 text-blue-600" />
                  <span className="text-sm">Unlock Vehicle</span>
                </Button>
              </div>
              
              <Button
                variant="secondary"
                className="w-full mt-4"
                onClick={() => sendVehicleCommand('locate')}
                disabled={state.isLoading}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Locate Vehicle
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Flutter Development Notice */}
        <Alert>
          <Smartphone className="h-4 w-4" />
          <AlertDescription>
            <strong>Flutter Development Ready!</strong><br />
            This mobile web interface demonstrates the complete API integration. 
            Use this as a reference for Flutter development with the same backend endpoints.
          </AlertDescription>
        </Alert>

        {/* API Endpoints Documentation */}
        <Card>
          <CardHeader>
            <CardTitle>Flutter Integration Endpoints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <div><strong>Authentication:</strong> /functions/v1/mobile-auth</div>
              <div><strong>Registration:</strong> /functions/v1/user-registration</div>
              <div><strong>Vehicle Registration:</strong> /functions/v1/vehicle-registration</div>
              <div><strong>Dashboard Data:</strong> /functions/v1/mobile-dashboard-data</div>
              <div><strong>Vehicle Control:</strong> /functions/v1/mobile-vehicle-control</div>
              <div><strong>OTP Services:</strong> /functions/v1/send-otp, /functions/v1/verify-otp</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}