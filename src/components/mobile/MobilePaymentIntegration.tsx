import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PaymentButton } from '@/components/payment/PaymentButton';
import { SubscriptionPlans } from '@/components/payment/SubscriptionPlans';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { 
  CreditCard, 
  Smartphone, 
  Shield, 
  CheckCircle,
  Clock,
  Car,
  Star
} from 'lucide-react';

interface MobilePaymentIntegrationProps {
  userId?: string;
  currentSubscription?: any;
}

export const MobilePaymentIntegration: React.FC<MobilePaymentIntegrationProps> = ({
  userId,
  currentSubscription
}) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'history' | 'vehicle'>('plans');
  const { toast } = useToast();
  
  const { transactions, stats, isLoading } = usePaymentStatus({ 
    userId,
    autoRefresh: true 
  });

  const handlePaymentSuccess = (reference: string) => {
    toast({
      title: "Payment Successful!",
      description: "Your subscription has been activated. Features will be available shortly.",
    });
    
    // Trigger any mobile-specific success actions
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({
        type: 'payment_success',
        reference,
        timestamp: new Date().toISOString()
      }));
    }
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive"
    });

    // Notify mobile app of payment failure
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({
        type: 'payment_error',
        error,
        timestamp: new Date().toISOString()
      }));
    }
  };

  const formatCurrency = (amount: number, currency = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-4 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Mobile Fleet Subscriptions</h2>
            <p className="text-sm text-muted-foreground">
              Manage your vehicle tracking subscriptions
            </p>
          </div>
        </div>
      </div>

      {/* Current Subscription Status */}
      {currentSubscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="w-5 h-5" />
              <span>Current Plan</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{currentSubscription.package_name || 'Active Plan'}</h3>
                <p className="text-sm text-muted-foreground">
                  Status: <Badge variant="default">Active</Badge>
                </p>
                {currentSubscription.next_payment_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Next payment: {new Date(currentSubscription.next_payment_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Car className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <Button
          variant={activeTab === 'plans' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setActiveTab('plans')}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Plans
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setActiveTab('history')}
        >
          <Clock className="w-4 h-4 mr-2" />
          History
        </Button>
        <Button
          variant={activeTab === 'vehicle' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => setActiveTab('vehicle')}
        >
          <Car className="w-4 h-4 mr-2" />
          Vehicles
        </Button>
      </div>

      {/* Content Sections */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Mobile Optimized:</strong> Our payment system is fully optimized for mobile devices with secure, fast checkout.
            </AlertDescription>
          </Alert>
          
          <SubscriptionPlans
            userId={userId}
            currentPlanCode={currentSubscription?.paystack_subscription_code}
            onPlanSelected={(planCode) => {
              console.log('Mobile: Plan selected', planCode);
            }}
          />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
                <p className="text-sm text-muted-foreground">Successful</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(stats.totalAmount)}
                </div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {transactions.slice(0, 10).map((transaction) => (
              <Card key={transaction.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <div className="text-sm font-medium">
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </div>
                        <Badge 
                          variant={
                            transaction.status === 'success' ? 'default' : 
                            transaction.status === 'failed' ? 'destructive' : 'secondary'
                          }
                        >
                          {transaction.status === 'success' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {transaction.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {transaction.description || 'Payment'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {transactions.length === 0 && !isLoading && (
              <Card>
                <CardContent className="p-6 text-center">
                  <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No payment history yet</p>
                  <p className="text-sm text-muted-foreground">
                    Your subscription payments will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'vehicle' && (
        <div className="space-y-4">
          <Alert>
            <Car className="h-4 w-4" />
            <AlertDescription>
              Your vehicle subscriptions are automatically linked to your GPS51 devices. 
              Each active subscription enables real-time tracking for your registered vehicles.
            </AlertDescription>
          </Alert>

          {/* Vehicle-specific payment options would go here */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Plan Upgrade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upgrade individual vehicles to premium tracking features
              </p>
              <PaymentButton
                amount={2500}
                currency="NGN"
                description="Premium Vehicle Tracking - Monthly"
                requiresPin={true}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                className="w-full"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mobile-specific features */}
      <Alert>
        <Smartphone className="h-4 w-4" />
        <AlertDescription>
          <strong>Mobile Features:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Instant payment notifications</li>
            <li>Biometric authentication support</li>
            <li>Offline payment queue</li>
            <li>Mobile wallet integration ready</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
};