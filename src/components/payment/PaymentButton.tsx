import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CreditCard, 
  Shield, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import type { PaymentInitRequest, PaymentInitResponse } from '@/types/payment';

interface PaymentButtonProps {
  amount: number;
  currency?: string;
  description: string;
  planCode?: string;
  orderId?: string;
  metadata?: Record<string, any>;
  requiresPin?: boolean;
  onSuccess?: (reference: string) => void;
  onError?: (error: string) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({
  amount,
  currency = 'NGN',
  description,
  planCode,
  orderId,
  metadata = {},
  requiresPin = false,
  onSuccess,
  onError,
  className,
  variant = 'default',
  size = 'default',
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [secretPin, setSecretPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const { toast } = useToast();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const handlePayment = async () => {
    try {
      setIsLoading(true);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Please log in to make a payment');
      }

      // Get user profile for email
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', user.id)
        .single();

      const email = profile?.email || user.email || '';
      
      if (!email) {
        throw new Error('Email address is required for payment');
      }

      // Prepare payment request
      const paymentRequest: PaymentInitRequest = {
        amount,
        currency,
        email,
        description,
        order_id: orderId,
        subscription_plan_code: planCode,
        metadata: {
          user_id: user.id,
          user_name: profile?.name || user.user_metadata?.name || 'Unknown',
          ...metadata
        }
      };

      // Add secret PIN if required
      if (requiresPin) {
        if (!secretPin) {
          setShowPinInput(true);
          setIsLoading(false);
          return;
        }
        paymentRequest.secret_pin = secretPin;
      }

      console.log('PaymentButton: Initializing payment', {
        amount,
        currency,
        description,
        hasOrderId: !!orderId,
        hasPlanCode: !!planCode
      });

      // Initialize payment
      const { data, error } = await supabase.functions.invoke('paystack-payment-init', {
        body: paymentRequest
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Payment initialization failed');
      }

      const response: PaymentInitResponse = data;

      // Redirect to Paystack payment page
      if (response.data?.authorization_url) {
        // Open payment URL in new window/tab
        const paymentWindow = window.open(
          response.data.authorization_url,
          'paystack-payment',
          'width=500,height=700,scrollbars=yes,resizable=yes'
        );

        // Monitor payment window
        const checkClosed = setInterval(() => {
          if (paymentWindow?.closed) {
            clearInterval(checkClosed);
            setIsLoading(false);
            
            // Check payment status
            toast({
              title: "Payment Window Closed",
              description: "Please check your transaction status in your account.",
            });
          }
        }, 1000);

        // Handle successful callback (this would typically be handled by the callback URL)
        onSuccess?.(response.data.reference);
        
        toast({
          title: "Payment Initiated",
          description: "Complete your payment in the opened window.",
        });
      }

    } catch (error: any) {
      console.error('PaymentButton: Payment error', error);
      
      const errorMessage = error.message || 'Payment failed. Please try again.';
      
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive"
      });

      onError?.(errorMessage);
      setIsLoading(false);
    }
  };

  const handlePinSubmit = () => {
    if (secretPin.length >= 4) {
      setShowPinInput(false);
      handlePayment();
    } else {
      toast({
        title: "Invalid PIN",
        description: "Please enter your 4-digit secret PIN",
        variant: "destructive"
      });
    }
  };

  if (showPinInput) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Confirm Payment</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {formatAmount(amount)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          </div>
          
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Enter your 4-digit secret PIN to confirm this payment
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <input
              type="password"
              maxLength={4}
              placeholder="Enter PIN"
              value={secretPin}
              onChange={(e) => setSecretPin(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-center text-lg font-mono"
              autoFocus
            />
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowPinInput(false);
                  setSecretPin('');
                  setIsLoading(false);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handlePinSubmit}
                disabled={secretPin.length < 4}
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button
      onClick={handlePayment}
      disabled={disabled || isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4 mr-2" />
          Pay {formatAmount(amount)}
        </>
      )}
    </Button>
  );
};