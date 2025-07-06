import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Lock, CheckCircle, AlertCircle } from 'lucide-react';


interface PINFormData {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}

export const PINManagement: React.FC = () => {
  const [formData, setFormData] = useState<PINFormData>({
    currentPin: '',
    newPin: '',
    confirmPin: ''
  });
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    checkExistingPin();
  }, []);

  const checkExistingPin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_pins')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking PIN:', error);
      }

      setHasExistingPin(!!data);
    } catch (error) {
      console.error('Error checking existing PIN:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const generateSalt = (): string => {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const hashPin = async (pin: string, salt: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const updateFormData = (field: keyof PINFormData, value: string) => {
    // Only allow numbers, limit to 6 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, [field]: numericValue }));
    if (error) setError('');
  };

  const validatePin = (pin: string): boolean => {
    return /^\d{4,6}$/.test(pin);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (hasExistingPin && !formData.currentPin) {
      setError('Please enter your current PIN');
      return;
    }

    if (!validatePin(formData.newPin)) {
      setError('PIN must be 4-6 digits');
      return;
    }

    if (formData.newPin !== formData.confirmPin) {
      setError('PINs do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // If updating existing PIN, verify current PIN first
      if (hasExistingPin) {
        const { data: existingPin } = await supabase
          .from('user_pins')
          .select('pin_hash, salt')
          .eq('user_id', user.id)
          .single();

        if (existingPin) {
          const currentPinHash = await hashPin(formData.currentPin, existingPin.salt);
          if (currentPinHash !== existingPin.pin_hash) {
            setError('Current PIN is incorrect');
            return;
          }
        }
      }

      // Generate new salt and hash
      const salt = generateSalt();
      const pinHash = await hashPin(formData.newPin, salt);

      // Update or insert PIN
      const { error } = await supabase
        .from('user_pins')
        .upsert({
          user_id: user.id,
          pin_hash: pinHash,
          salt: salt
        });

      if (error) throw error;

      toast({
        title: hasExistingPin ? "PIN Updated" : "PIN Created",
        description: "Your security PIN has been saved successfully",
      });

      // Reset form
      setFormData({
        currentPin: '',
        newPin: '',
        confirmPin: ''
      });

      // Update state
      setHasExistingPin(true);

    } catch (error: any) {
      setError(error.message || 'Failed to save PIN');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2" />
        <span>Checking PIN status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security PIN Management
        </h3>
        <p className="text-muted-foreground">
          Set up a secure PIN for marketplace purchases and sensitive operations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {hasExistingPin ? 'Update Security PIN' : 'Create Security PIN'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {hasExistingPin && (
              <div className="space-y-2">
                <Label htmlFor="current-pin">Current PIN</Label>
                <Input
                  id="current-pin"
                  type="password"
                  value={formData.currentPin}
                  onChange={(e) => updateFormData('currentPin', e.target.value)}
                  placeholder="Enter current PIN"
                  maxLength={6}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-pin">
                {hasExistingPin ? 'New PIN' : 'Create PIN'}
              </Label>
              <Input
                id="new-pin"
                type="password"
                value={formData.newPin}
                onChange={(e) => updateFormData('newPin', e.target.value)}
                placeholder="Enter 4-6 digit PIN"
                maxLength={6}
                required
              />
              <p className="text-sm text-muted-foreground">
                PIN must be 4-6 digits (numbers only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-pin">Confirm PIN</Label>
              <Input
                id="confirm-pin"
                type="password"
                value={formData.confirmPin}
                onChange={(e) => updateFormData('confirmPin', e.target.value)}
                placeholder="Confirm your PIN"
                maxLength={6}
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {hasExistingPin ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {hasExistingPin ? 'Update PIN' : 'Create PIN'}
                </>
              )}
            </Button>
          </form>

          {hasExistingPin && (
            <Alert className="mt-4">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Your security PIN is currently active and will be required for marketplace purchases.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PIN Security Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Secure Storage</p>
              <p className="text-sm text-muted-foreground">
                Your PIN is encrypted and securely stored in our database
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Purchase Protection</p>
              <p className="text-sm text-muted-foreground">
                Required for all marketplace purchases to prevent unauthorized transactions
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Account Security</p>
              <p className="text-sm text-muted-foreground">
                Adds an extra layer of security to your account
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};