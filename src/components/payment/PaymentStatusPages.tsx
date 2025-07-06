import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ArrowLeft, 
  Receipt,
  CreditCard,
  RefreshCw
} from 'lucide-react';

// Payment Success Page
export const PaymentSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const amount = searchParams.get('amount');
  
  const { getTransactionByReference } = usePaymentStatus();
  const transaction = reference ? getTransactionByReference(reference) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">Payment Successful!</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Your payment has been processed successfully. You should receive a confirmation email shortly.
            </AlertDescription>
          </Alert>

          {transaction && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transaction ID:</span>
                  <span className="text-sm font-mono">{transaction.paystack_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat('en-NG', {
                      style: 'currency',
                      currency: transaction.currency
                    }).format(transaction.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="default">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Successful
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/settings?tab=subscriptions">
                <Receipt className="w-4 h-4 mr-2" />
                View Subscriptions
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Payment Failed Page
export const PaymentFailedPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const error = searchParams.get('error');

  const { getTransactionByReference } = usePaymentStatus();
  const transaction = reference ? getTransactionByReference(reference) : null;

  const getErrorMessage = () => {
    switch (error) {
      case 'transaction_not_found':
        return 'The transaction could not be found in our records.';
      case 'verification_failed':
        return 'Payment verification failed. Your card may not have been charged.';
      default:
        return 'An error occurred while processing your payment. Please try again.';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-800">Payment Failed</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-red-200 bg-red-50" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {getErrorMessage()}
            </AlertDescription>
          </Alert>

          {transaction && (
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reference:</span>
                  <span className="text-sm font-mono">{transaction.paystack_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    Failed
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              Try Payment Again
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Payment Cancelled Page
export const PaymentCancelledPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl text-yellow-800">Payment Cancelled</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              You cancelled the payment process. No charges have been made to your account.
            </AlertDescription>
          </Alert>

          {reference && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reference:</span>
                <span className="text-sm font-mono">{reference}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button className="w-full">
              <CreditCard className="w-4 h-4 mr-2" />
              Try Payment Again
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Payment Status Check Page
export const PaymentStatusPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { getTransactionByReference, refetch } = usePaymentStatus();
  const transaction = reference ? getTransactionByReference(reference) : null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  useEffect(() => {
    // Auto-refresh every 5 seconds for pending transactions
    if (transaction?.status === 'initiated') {
      const interval = setInterval(refetch, 5000);
      return () => clearInterval(interval);
    }
  }, [transaction?.status, refetch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'initiated': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'cancelled': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-6 h-6" />;
      case 'failed': return <XCircle className="w-6 h-6" />;
      case 'initiated': return <Clock className="w-6 h-6" />;
      case 'cancelled': return <AlertTriangle className="w-6 h-6" />;
      default: return <Clock className="w-6 h-6" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex flex-col items-center text-center space-y-2">
            <CardTitle className="text-2xl">Payment Status</CardTitle>
            {reference && (
              <p className="text-sm text-muted-foreground font-mono">{reference}</p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {transaction ? (
            <>
              <div className={`p-4 rounded-lg border ${getStatusColor(transaction.status)}`}>
                <div className="flex items-center space-x-3">
                  {getStatusIcon(transaction.status)}
                  <div>
                    <div className="font-semibold capitalize">{transaction.status}</div>
                    <div className="text-sm opacity-80">
                      {transaction.status === 'initiated' && 'Processing payment...'}
                      {transaction.status === 'success' && 'Payment completed successfully'}
                      {transaction.status === 'failed' && 'Payment was unsuccessful'}
                      {transaction.status === 'cancelled' && 'Payment was cancelled'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat('en-NG', {
                      style: 'currency',
                      currency: transaction.currency
                    }).format(transaction.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span className="text-sm">
                    {new Date(transaction.created_at).toLocaleString()}
                  </span>
                </div>
                {transaction.description && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Description:</span>
                    <span className="text-sm">{transaction.description}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Transaction not found. Please check your reference number.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              variant="outline" 
              className="w-full"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};