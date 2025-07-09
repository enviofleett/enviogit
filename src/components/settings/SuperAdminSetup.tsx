import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Crown, CheckCircle, AlertCircle } from 'lucide-react';

export const SuperAdminSetup: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const setupSuperAdmin = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Get admin credentials from environment or prompt user
      const adminEmail = 'chudesyl@gmail.com';
      const adminPassword = '@octopus100%';
      
      const { data, error } = await supabase.functions.invoke('setup-super-admin', {
        body: {
          email: adminEmail,
          password: adminPassword,
          action: 'create_admin_account'
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setSetupComplete(true);
        toast({
          title: "Super Admin Setup Complete",
          description: "Admin account created and configured successfully",
        });
      } else {
        throw new Error(data?.error || 'Setup failed');
      }

    } catch (error: any) {
      console.error('Super admin setup error:', error);
      setError(error.message || 'Failed to setup super admin');
      toast({
        title: "Setup Failed",
        description: error.message || 'Failed to setup super admin',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (setupComplete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Super Admin Setup Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Super admin account has been created successfully for chudesyl@gmail.com
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Super Admin Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            This will create a super admin account for chudesyl@gmail.com with full system access.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={setupSuperAdmin} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Setting up Super Admin...
            </div>
          ) : (
            <>
              <Crown className="h-4 w-4 mr-2" />
              Create Super Admin Account
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};