import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  Wallet, 
  TrendingUp, 
  CheckCircle, 
  XCircle,
  Eye,
  Download,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { PartnerWalletService } from '@/services/partners/PartnerWalletService';
import { PartnerCommissionService } from '@/services/partners/PartnerCommissionService';

export const FinancialManagement = () => {
  const [wallets, setWallets] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      setIsLoading(true);
      const [walletsData, payoutsData, earningsData, summaryData] = await Promise.all([
        PartnerWalletService.getAllWallets(),
        PartnerWalletService.getAllPayoutRequests(),
        PartnerCommissionService.getAllEarnings(),
        PartnerWalletService.getWalletSummary()
      ]);

      setWallets(walletsData);
      setPayoutRequests(payoutsData);
      setEarnings(earningsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading financial data:', error);
      toast({
        title: "Error",
        description: "Failed to load financial data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovePayout = async (requestId: string) => {
    try {
      await PartnerWalletService.approvePayoutRequest(requestId, 'admin-user-id');
      toast({
        title: "Success",
        description: "Payout approved and processed",
      });
      loadFinancialData();
    } catch (error) {
      console.error('Error approving payout:', error);
      toast({
        title: "Error",
        description: "Failed to approve payout",
        variant: "destructive",
      });
    }
  };

  const handleRejectPayout = async (requestId: string, reason: string) => {
    try {
      await PartnerWalletService.rejectPayoutRequest(requestId, reason);
      toast({
        title: "Success",
        description: "Payout request rejected",
      });
      loadFinancialData();
    } catch (error) {
      console.error('Error rejecting payout:', error);
      toast({
        title: "Error",
        description: "Failed to reject payout",
        variant: "destructive",
      });
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  const WalletCard = ({ wallet }: { wallet: any }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold">{wallet.technical_partners?.name}</h3>
            <p className="text-sm text-muted-foreground">{wallet.technical_partners?.email}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">₦{parseFloat(wallet.current_balance).toFixed(2)}</div>
            <Badge variant={parseFloat(wallet.current_balance) > 0 ? "default" : "secondary"}>
              {parseFloat(wallet.current_balance) > 0 ? "Funded" : "Empty"}
            </Badge>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => setSelectedWallet(wallet)}>
                <Eye className="h-3 w-3 mr-1" />
                View Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Wallet Details: {wallet.technical_partners?.name}</DialogTitle>
              </DialogHeader>
              <WalletDetails wallet={wallet} />
            </DialogContent>
          </Dialog>
          
          <Button size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" />
            Adjust
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const PayoutRequestCard = ({ request }: { request: any }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold">₦{parseFloat(request.amount).toFixed(2)}</h3>
            <p className="text-sm text-muted-foreground">
              {request.technical_partners?.name} - {request.technical_partners?.email}
            </p>
            <p className="text-xs text-muted-foreground">
              Requested: {new Date(request.requested_at).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={
            request.status === 'pending' ? 'secondary' :
            request.status === 'approved' ? 'default' : 'destructive'
          }>
            {request.status}
          </Badge>
        </div>

        {request.status === 'pending' && (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => handleApprovePayout(request.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject Payout Request</DialogTitle>
                </DialogHeader>
                <RejectPayoutForm 
                  request={request} 
                  onReject={handleRejectPayout}
                />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const WalletDetails = ({ wallet }: { wallet: any }) => (
    <Tabs defaultValue="summary" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
        <TabsTrigger value="earnings">Earnings</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Current Balance</label>
            <p className="text-lg font-bold">₦{parseFloat(wallet.current_balance).toFixed(2)}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Total Earnings</label>
            <p className="text-lg font-bold">₦{wallet.total_earnings?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Total Payouts</label>
            <p className="text-lg font-bold">₦{wallet.total_payouts?.toFixed(2) || '0.00'}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Created</label>
            <p className="text-sm text-muted-foreground">
              {new Date(wallet.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="transactions" className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Transaction history will be available soon</p>
        </div>
      </TabsContent>

      <TabsContent value="earnings" className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Earnings breakdown will be available soon</p>
        </div>
      </TabsContent>
    </Tabs>
  );

  const RejectPayoutForm = ({ request, onReject }: { request: any, onReject: (id: string, reason: string) => void }) => {
    const [reason, setReason] = useState('');

    return (
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Rejection Reason</label>
          <Textarea
            placeholder="Please provide a reason for rejecting this payout request..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline">Cancel</Button>
          <Button 
            variant="destructive" 
            onClick={() => onReject(request.id, reason)}
            disabled={!reason.trim()}
          >
            Reject Request
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Wallet Balance"
          value={`₦${summary.totalBalance?.toLocaleString() || '0'}`}
          icon={Wallet}
          color="text-green-600"
          subtitle="Across all partners"
        />
        <StatCard
          title="Pending Payouts"
          value={payoutRequests.filter(req => req.status === 'pending').length}
          icon={AlertCircle}
          color="text-orange-600"
          subtitle="Awaiting approval"
        />
        <StatCard
          title="Monthly Earnings"
          value={`₦${summary.monthlyEarnings?.toLocaleString() || '0'}`}
          icon={TrendingUp}
          color="text-blue-600"
          subtitle="This month"
        />
        <StatCard
          title="Total Payouts"
          value={`₦${summary.totalPayouts?.toLocaleString() || '0'}`}
          icon={DollarSign}
          color="text-purple-600"
          subtitle="All time"
        />
      </div>

      {/* Tabs for different financial views */}
      <Tabs defaultValue="wallets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="wallets">Partner Wallets</TabsTrigger>
          <TabsTrigger value="payouts">Payout Requests</TabsTrigger>
          <TabsTrigger value="reports">Financial Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="wallets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Partner Wallets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wallets.length === 0 ? (
                <Alert>
                  <AlertDescription>No partner wallets found</AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {wallets.map((wallet) => (
                    <WalletCard key={wallet.id} wallet={wallet} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payout Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payoutRequests.length === 0 ? (
                <Alert>
                  <AlertDescription>No payout requests found</AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {payoutRequests.map((request) => (
                    <PayoutRequestCard key={request.id} request={request} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Financial Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Advanced financial reporting will be available soon</p>
                <p className="text-sm">Export earnings, commission reports, and financial analytics</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};