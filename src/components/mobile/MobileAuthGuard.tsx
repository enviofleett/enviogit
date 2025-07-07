import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, LogIn, UserPlus, AlertTriangle, Wifi, Clock } from 'lucide-react';
import { gps51ErrorHandler } from '@/services/gps51/GPS51CentralizedErrorHandler';

interface MobileAuthGuardProps {
  onAuthenticated: (authData: any) => void;
}

export function MobileAuthGuard({ onAuthenticated }: MobileAuthGuardProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    const startTime = Date.now();

    try {
      if (isLogin) {
        // Enhanced GPS51-first authentication with error handling
        console.log('MobileAuthGuard: Starting GPS51 authentication:', {
          email: formData.email,
          timestamp: new Date().toISOString()
        });

        const { data: gps51Auth, error } = await supabase.functions.invoke('mobile-auth', {
          body: {
            email: formData.email,
            password: formData.password,
            deviceInfo: {
              platform: navigator.platform.toLowerCase().includes('mac') || 
                         navigator.platform.toLowerCase().includes('iphone') ? 'ios' : 
                         navigator.platform.toLowerCase().includes('android') ? 'android' : 'web',
              deviceId: 'mobile-web-app',
              appVersion: '1.0.0',
              userAgent: navigator.userAgent
            }
          }
        });

        const processingTime = Date.now() - startTime;

        if (error) {
          console.error('MobileAuthGuard: Edge function invocation error:', error);
          
          // Use centralized error handler for analysis
          const gps51Error = gps51ErrorHandler.handleError(new Error(error.message), {
            context: 'mobile_auth',
            email: formData.email,
            processingTime,
            errorSource: 'edge_function'
          });

          setAuthError(gps51Error);
          throw new Error(error.message || 'Authentication service error');
        }

        if (!gps51Auth) {
          const noResponseError = new Error('No response from authentication service');
          const gps51Error = gps51ErrorHandler.handleError(noResponseError, {
            context: 'mobile_auth',
            email: formData.email,
            processingTime,
            errorSource: 'no_response'
          });
          
          setAuthError(gps51Error);
          throw noResponseError;
        }

        console.log('MobileAuthGuard: GPS51 auth response received:', {
          success: gps51Auth.success,
          hasUser: !!gps51Auth.user,
          hasAuth: !!gps51Auth.auth,
          processingTime
        });

        if (gps51Auth.success && gps51Auth.user && gps51Auth.auth) {
          onAuthenticated({
            user: gps51Auth.user,
            gps51Token: gps51Auth.auth.gps51Token,
            subscription: gps51Auth.subscription,
            vehicles: gps51Auth.vehicles,
            authMethod: 'gps51_first'
          });
          
          toast({
            title: "Login Successful",
            description: `Welcome back, ${gps51Auth.user.name}! Connected to GPS51.`,
            duration: 5000
          });

          console.log('MobileAuthGuard: Authentication completed successfully:', {
            userId: gps51Auth.user.id,
            vehicleCount: gps51Auth.vehicles?.length || 0,
            processingTime
          });
        } else {
          const authFailedError = new Error(gps51Auth?.error || 'GPS51 authentication failed');
          
          // Use centralized error handler for GPS51-specific error analysis
          const gps51Error = gps51ErrorHandler.handleError(authFailedError, {
            context: 'gps51_auth',
            email: formData.email,
            processingTime,
            response: gps51Auth,
            errorSource: 'gps51_response'
          });

          setAuthError(gps51Error);
          throw authFailedError;
        }
      } else {
        // Enhanced registration flow with error handling
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }

        if (formData.password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }

        console.log('MobileAuthGuard: Starting user registration');

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/mobile`
          }
        });

        if (error) {
          const registrationError = gps51ErrorHandler.handleError(error, {
            context: 'registration',
            email: formData.email,
            errorSource: 'supabase_auth'
          });
          
          setAuthError(registrationError);
          throw error;
        }

        toast({
          title: "Registration Successful",
          description: "Please check your email to verify your account",
          duration: 7000
        });

        console.log('MobileAuthGuard: Registration completed successfully');
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      console.error('MobileAuthGuard: Authentication error:', {
        error: error.message,
        processingTime,
        isLogin,
        email: formData.email
      });

      // Enhanced error messaging based on error analysis
      let errorTitle = isLogin ? "Login Failed" : "Registration Failed";
      let errorDescription = error.message;
      let errorIcon = AlertTriangle;

      if (authError) {
        // Use centralized error handler insights
        const suggestions = authError.context?.suggestions || [];
        
        if (authError.type === 'network') {
          errorIcon = Wifi;
          errorTitle = "Connection Error";
          errorDescription = "Please check your internet connection and try again.";
        } else if (authError.type === 'rate_limit') {
          errorIcon = Clock;
          errorTitle = "Too Many Attempts";
          errorDescription = "Please wait a moment before trying again.";
        } else if (authError.type === 'authentication') {
          errorTitle = "Invalid Credentials";
          errorDescription = "Please check your email and password are correct.";
        }

        if (suggestions.length > 0) {
          errorDescription += ` Suggestion: ${suggestions[0]}`;
        }
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get error statistics for display
  const errorStats = gps51ErrorHandler.getErrorStats();
  const hasRecentErrors = errorStats.recentErrors > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Smartphone className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Fleet Mobile</CardTitle>
          <p className="text-muted-foreground">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                disabled={isLoading}
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Please wait...' : (
                <>
                  {isLogin ? <LogIn className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  {isLogin ? 'Sign In' : 'Sign Up'}
                </>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary"
                disabled={isLoading}
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>

          <Alert className="mt-4">
            <AlertDescription>
              <strong>Demo Credentials:</strong><br />
              You can test with your GPS51 account credentials or create a new account.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}