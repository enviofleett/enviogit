import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, Car, Users, Settings, CheckCircle, AlertCircle } from 'lucide-react';

export function MobileUserManagementPanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();

  // User Registration Test
  const [userForm, setUserForm] = useState({
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    city: 'New York',
    country: 'USA',
    password: 'TestPassword123',
    otpToken: 'verified'
  });

  // Vehicle Registration Test
  const [vehicleForm, setVehicleForm] = useState({
    deviceId: 'TEST_DEVICE_001',
    deviceName: 'Test Vehicle',
    deviceType: 'GPS',
    userId: '',
    gps51Token: ''
  });

  // Authentication Test
  const [authForm, setAuthForm] = useState({
    email: 'john.doe@example.com',
    password: 'TestPassword123'
  });

  const testUserRegistration = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-registration', {
        body: userForm
      });

      if (error) throw error;

      setTestResults(prev => ({
        ...prev,
        userRegistration: { success: true, data }
      }));

      toast({ title: "User Registration Test", description: "✅ Successfully created test user" });
      
      // Update vehicle form with user ID
      if (data.profile?.id) {
        setVehicleForm(prev => ({ ...prev, userId: data.profile.id }));
      }
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        userRegistration: { success: false, error: error.message }
      }));
      toast({ title: "User Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const testMobileAuth = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mobile-auth', {
        body: {
          ...authForm,
          deviceInfo: {
            platform: 'web',
            deviceId: 'test-device-001',
            appVersion: '1.0.0'
          }
        }
      });

      if (error) throw error;

      setTestResults(prev => ({
        ...prev,
        mobileAuth: { success: true, data }
      }));

      toast({ title: "Mobile Authentication Test", description: "✅ Successfully authenticated user" });
      
      // Update vehicle form with GPS51 token
      if (data.auth?.gps51Token) {
        setVehicleForm(prev => ({ ...prev, gps51Token: data.auth.gps51Token }));
      }
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        mobileAuth: { success: false, error: error.message }
      }));
      toast({ title: "Mobile Authentication Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const testVehicleRegistration = async () => {
    if (!vehicleForm.userId || !vehicleForm.gps51Token) {
      toast({ 
        title: "Missing Requirements", 
        description: "Please run User Registration and Mobile Auth tests first", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('vehicle-registration', {
        body: vehicleForm
      });

      if (error) throw error;

      setTestResults(prev => ({
        ...prev,
        vehicleRegistration: { success: true, data }
      }));

      toast({ title: "Vehicle Registration Test", description: "✅ Successfully registered test vehicle" });
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        vehicleRegistration: { success: false, error: error.message }
      }));
      toast({ title: "Vehicle Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const testFeatureAccess = async () => {
    if (!vehicleForm.userId || !vehicleForm.gps51Token) {
      toast({ 
        title: "Missing Requirements", 
        description: "Please complete previous tests first", 
        variant: "destructive" 
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('feature-access-control', {
        body: {
          userId: vehicleForm.userId,
          gps51Action: 'querymonitorlist',
          gps51Token: vehicleForm.gps51Token,
          params: {}
        }
      });

      if (error) throw error;

      setTestResults(prev => ({
        ...prev,
        featureAccess: { success: true, data }
      }));

      toast({ title: "Feature Access Test", description: "✅ Successfully accessed GPS51 feature" });
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        featureAccess: { success: false, error: error.message }
      }));
      toast({ title: "Feature Access Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Fleet Management System
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test the complete mobile user registration and vehicle management system with GPS51 integration.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Test Flow Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center p-4 bg-secondary/50 rounded-lg">
              <Users className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">User Registration</span>
              {testResults?.userRegistration ? (
                <Badge variant={testResults.userRegistration.success ? "default" : "destructive"} className="mt-1">
                  {testResults.userRegistration.success ? "✅ Success" : "❌ Failed"}
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1">Pending</Badge>
              )}
            </div>
            
            <div className="flex flex-col items-center p-4 bg-secondary/50 rounded-lg">
              <Smartphone className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Mobile Auth</span>
              {testResults?.mobileAuth ? (
                <Badge variant={testResults.mobileAuth.success ? "default" : "destructive"} className="mt-1">
                  {testResults.mobileAuth.success ? "✅ Success" : "❌ Failed"}
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1">Pending</Badge>
              )}
            </div>
            
            <div className="flex flex-col items-center p-4 bg-secondary/50 rounded-lg">
              <Car className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Vehicle Reg</span>
              {testResults?.vehicleRegistration ? (
                <Badge variant={testResults.vehicleRegistration.success ? "default" : "destructive"} className="mt-1">
                  {testResults.vehicleRegistration.success ? "✅ Success" : "❌ Failed"}
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1">Pending</Badge>
              )}
            </div>
            
            <div className="flex flex-col items-center p-4 bg-secondary/50 rounded-lg">
              <Settings className="h-8 w-8 mb-2 text-primary" />
              <span className="text-sm font-medium">Feature Access</span>
              {testResults?.featureAccess ? (
                <Badge variant={testResults.featureAccess.success ? "default" : "destructive"} className="mt-1">
                  {testResults.featureAccess.success ? "✅ Success" : "❌ Failed"}
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1">Pending</Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Test Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* User Registration Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  1. User Registration Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Full Name</Label>
                    <Input 
                      value={userForm.fullName}
                      onChange={(e) => setUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input 
                      value={userForm.email}
                      onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input 
                      value={userForm.phone}
                      onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">City</Label>
                    <Input 
                      value={userForm.city}
                      onChange={(e) => setUserForm(prev => ({ ...prev, city: e.target.value }))}
                      className="h-8"
                    />
                  </div>
                </div>
                <Button 
                  onClick={testUserRegistration} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Creating User..." : "Test User Registration"}
                </Button>
              </CardContent>
            </Card>

            {/* Mobile Authentication Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  2. Mobile Authentication Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input 
                    value={authForm.email}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Password</Label>
                  <Input 
                    type="password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                    className="h-8"
                  />
                </div>
                <Button 
                  onClick={testMobileAuth} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Authenticating..." : "Test Mobile Authentication"}
                </Button>
              </CardContent>
            </Card>

            {/* Vehicle Registration Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  3. Vehicle Registration Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Device ID</Label>
                  <Input 
                    value={vehicleForm.deviceId}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, deviceId: e.target.value }))}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Device Name</Label>
                  <Input 
                    value={vehicleForm.deviceName}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, deviceName: e.target.value }))}
                    className="h-8"
                  />
                </div>
                <div className="flex gap-2 text-xs">
                  <span>User ID: {vehicleForm.userId || 'Not set'}</span>
                  <span>Token: {vehicleForm.gps51Token ? '✅' : '❌'}</span>
                </div>
                <Button 
                  onClick={testVehicleRegistration} 
                  disabled={isLoading || !vehicleForm.userId || !vehicleForm.gps51Token}
                  className="w-full"
                >
                  {isLoading ? "Registering Vehicle..." : "Test Vehicle Registration"}
                </Button>
              </CardContent>
            </Card>

            {/* Feature Access Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  4. Feature Access Control Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Test subscription-based feature access control by attempting to query GPS51 vehicle list.
                </p>
                <Button 
                  onClick={testFeatureAccess} 
                  disabled={isLoading || !vehicleForm.userId || !vehicleForm.gps51Token}
                  className="w-full"
                >
                  {isLoading ? "Testing Access..." : "Test Feature Access"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Test Results */}
          {testResults && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Test Results</h3>
                
                {Object.entries(testResults).map(([key, result]: [string, any]) => (
                  <Alert key={key} className="p-4">
                    <div className="flex items-start gap-2">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium capitalize">
                          {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </div>
                        <AlertDescription className="mt-1">
                          {result.success ? (
                            <div className="space-y-2">
                              <p className="text-green-700">✅ Success</p>
                              <pre className="text-xs bg-green-50 p-2 rounded overflow-auto max-h-32">
                                {JSON.stringify(result.data, null, 2)}
                              </pre>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-red-700">❌ Error: {result.error}</p>
                            </div>
                          )}
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}