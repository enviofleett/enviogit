import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Smartphone, LogIn, UserPlus } from 'lucide-react';

interface MobileAuthGuardProps {
  onAuthenticated: (authData: any) => void;
}

export function MobileAuthGuard({ onAuthenticated }: MobileAuthGuardProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login flow
        const { data: authResult, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        if (error) throw error;

        if (authResult.session?.user) {
          // Authenticate with GPS51
          const { data: gps51Auth } = await supabase.functions.invoke('mobile-auth', {
            body: {
              email: formData.email,
              password: formData.password,
              deviceInfo: {
                platform: 'web',
                deviceId: 'mobile-web-app',
                appVersion: '1.0.0'
              }
            }
          });

          if (gps51Auth?.success) {
            onAuthenticated({
              user: gps51Auth.user,
              gps51Token: gps51Auth.auth.gps51Token,
              subscription: gps51Auth.subscription,
              vehicles: gps51Auth.vehicles
            });
            
            toast({
              title: "Login Successful",
              description: `Welcome back, ${gps51Auth.user.name}!`
            });
          } else {
            throw new Error(gps51Auth?.error || 'GPS51 authentication failed');
          }
        }
      } else {
        // Registration flow
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/mobile`
          }
        });

        if (error) throw error;

        toast({
          title: "Registration Successful",
          description: "Please check your email to verify your account"
        });
      }
    } catch (error: any) {
      toast({
        title: isLogin ? "Login Failed" : "Registration Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

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