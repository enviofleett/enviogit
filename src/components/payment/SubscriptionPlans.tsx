import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PaymentButton } from './PaymentButton';
import { 
  Check, 
  Star, 
  Car, 
  MapPin, 
  AlertTriangle,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import type { PaystackPlan } from '@/types/payment';

interface SubscriptionPlansProps {
  onPlanSelected?: (planCode: string) => void;
  currentPlanCode?: string;
  userId?: string;
}

const PLAN_FEATURES = {
  basic: [
    'Real-time GPS tracking',
    'Basic vehicle monitoring',
    'Email alerts',
    '7-day position history',
    'Mobile app access'
  ],
  premium: [
    'Everything in Basic',
    'Advanced analytics',
    'Geofencing alerts',
    '30-day position history',
    'Multiple vehicle support',
    'Priority support'
  ],
  enterprise: [
    'Everything in Premium',
    'Custom reporting',
    'API access',
    'Unlimited history',
    'Fleet management tools',
    'Dedicated support',
    'White-label options'
  ]
};

const PLAN_COLORS = {
  basic: 'bg-blue-50 border-blue-200',
  premium: 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200',
  enterprise: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
};

export const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({
  onPlanSelected,
  currentPlanCode,
  userId
}) => {
  const [plans, setPlans] = useState<PaystackPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PaystackPlan | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('paystack_plans')
        .select('*')
        .eq('is_active', true)
        .order('amount', { ascending: true });

      if (error) throw error;

      setPlans((data || []) as PaystackPlan[]);
    } catch (error: any) {
      console.error('Failed to fetch subscription plans:', error);
      toast({
        title: "Error Loading Plans",
        description: "Failed to load subscription plans. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanSelect = (plan: PaystackPlan) => {
    setSelectedPlan(plan);
    onPlanSelected?.(plan.paystack_plan_code);
  };

  const handlePaymentSuccess = (reference: string) => {
    toast({
      title: "Payment Successful!",
      description: "Your subscription has been activated. You should receive a confirmation email shortly.",
    });
    
    // Refresh plans to update current status
    setTimeout(() => {
      fetchPlans();
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive"
    });
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getPlanType = (planCode: string): 'basic' | 'premium' | 'enterprise' => {
    if (planCode.toLowerCase().includes('premium')) return 'premium';
    if (planCode.toLowerCase().includes('enterprise')) return 'enterprise';
    return 'basic';
  };

  const isCurrentPlan = (planCode: string) => {
    return currentPlanCode === planCode;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="h-4 bg-muted rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Choose Your Plan</h2>
        <p className="text-muted-foreground">
          Select the perfect plan for your fleet management needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const planType = getPlanType(plan.paystack_plan_code);
          const features = PLAN_FEATURES[planType] || PLAN_FEATURES.basic;
          const isPopular = planType === 'premium';
          const isCurrent = isCurrentPlan(plan.paystack_plan_code);

          return (
            <Card 
              key={plan.id} 
              className={`relative ${PLAN_COLORS[planType]} ${
                isPopular ? 'ring-2 ring-purple-300 scale-105' : ''
              } ${isCurrent ? 'ring-2 ring-green-300' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-purple-600 text-white px-3 py-1">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold capitalize">
                  {plan.name}
                </CardTitle>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">
                    {formatPrice(plan.amount, plan.currency)}
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">
                    per {plan.interval}
                  </p>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      <Check className="w-4 h-4 mr-2" />
                      Current Plan
                    </Button>
                  ) : (
                    <PaymentButton
                      amount={plan.amount}
                      currency={plan.currency}
                      description={`${plan.name} subscription - ${plan.interval}`}
                      planCode={plan.paystack_plan_code}
                      requiresPin={true}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      className="w-full"
                      variant={isPopular ? 'default' : 'outline'}
                    />
                  )}

                  {planType === 'basic' && (
                    <p className="text-xs text-muted-foreground text-center">
                      Perfect for individual vehicle owners
                    </p>
                  )}
                  {planType === 'premium' && (
                    <p className="text-xs text-muted-foreground text-center">
                      Best for small to medium fleets
                    </p>
                  )}
                  {planType === 'enterprise' && (
                    <p className="text-xs text-muted-foreground text-center">
                      Ideal for large fleet operations
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Secure Payment Processing</strong><br />
          All payments are processed securely through Paystack. Your card information is never stored on our servers.
        </AlertDescription>
      </Alert>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Need a custom plan? <button className="text-primary hover:underline">Contact our sales team</button>
        </p>
        <p className="text-xs text-muted-foreground">
          All plans include 24/7 monitoring and can be cancelled anytime
        </p>
      </div>
    </div>
  );
};