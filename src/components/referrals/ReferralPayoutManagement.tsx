import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  DollarSign,
  Users
} from 'lucide-react';
import { ReferralPayoutService } from '@/services/referrals/ReferralPayoutService';
import { ReferralCommissionService } from '@/services/referrals/ReferralCommissionService';
import { useToast } from '@/hooks/use-toast';

export const ReferralPayoutManagement = () => {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<any>({});
  const [commissionSummary, setCommissionSummary] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkPayoutDialogOpen, setIsBulkPayoutDialogOpen] = useState(false);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPayoutData();
  }, []);

  const loadPayoutData = async () => {
    try {
      setIsLoading(true);
      const [payoutsData, payoutSummaryData, commissionSummaryData] = await Promise.all([
        ReferralPayoutService.getAllPayouts(),
        ReferralPayoutService.getPayoutSummary(),
        ReferralCommissionService.getCommissionSummary()
      ]);
      
      setPayouts(payoutsData);
      setPayoutSummary(payoutSummaryData);
      setCommissionSummary(commissionSummaryData);
    } catch (error) {
      console.error('Error loading payout data:', error);
      toast({
        title: "Error",
        description: "Failed to load payout data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkPayout = async () => {
    try {
      setIsProcessingPayout(true);
      const result = await ReferralPayoutService.initiateBulkPayout();
      
      toast({
        title: "Success",
        description: `Bulk payout initiated for ${result.processedAgents} agents (₦${result.totalAmount.toLocaleString()})`,
      });
      
      setIsBulkPayoutDialogOpen(false);
      loadPayoutData();
    } catch (error) {
      console.error('Error processing bulk payout:', error);
      toast({
        title: "Error",
        description: "Failed to process bulk payout",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const handleIndividualPayout = async (agentId: string) => {
    try {
      setIsProcessingPayout(true);
      const result = await ReferralPayoutService.initiateAgentPayout(agentId);
      
      toast({
        title: "Success",
        description: "Individual payout initiated successfully",
      });
      
      loadPayoutData();
    } catch (error) {
      console.error('Error processing individual payout:', error);
      toast({
        title: "Error",
        description: "Failed to process individual payout",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Payouts</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₦{(commissionSummary.pendingAmount || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {commissionSummary.pendingCommissions || 0} commissions
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  ₦{(payoutSummary.totalAmount || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {payoutSummary.completedPayouts || 0} payouts
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-blue-600">
                  {payoutSummary.pendingPayouts || 0}
                </p>
                <p className="text-xs text-muted-foreground">pending requests</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Payout Section */}
      {commissionSummary.pendingAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bulk Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pending Commissions Ready for Payout</AlertTitle>
              <AlertDescription>
                There are ₦{commissionSummary.pendingAmount.toLocaleString()} in pending commissions 
                ready to be paid out to agents.
              </AlertDescription>
            </Alert>
            
            <div className="mt-4">
              <Dialog open={isBulkPayoutDialogOpen} onOpenChange={setIsBulkPayoutDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Initiate Bulk Payout
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Bulk Payout</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Bulk Payout Confirmation</AlertTitle>
                      <AlertDescription>
                        You are about to initiate a bulk payout of ₦{commissionSummary.pendingAmount.toLocaleString()} 
                        to all agents with pending commissions. This action cannot be undone.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span>Total Amount:</span>
                        <span className="font-bold">₦{commissionSummary.pendingAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Number of Commissions:</span>
                        <span>{commissionSummary.pendingCommissions}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsBulkPayoutDialogOpen(false)}
                      disabled={isProcessingPayout}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleBulkPayout}
                      disabled={isProcessingPayout}
                    >
                      {isProcessingPayout ? 'Processing...' : 'Confirm Payout'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paystack Reference</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell>
                    {new Date(payout.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{payout.referring_agents?.name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">{payout.referring_agents?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    ₦{parseFloat(payout.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(payout.status)} flex items-center gap-1`}>
                      {getStatusIcon(payout.status)}
                      {payout.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payout.paystack_transfer_code ? (
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {payout.paystack_transfer_code}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {payout.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleIndividualPayout(payout.agent_id)}
                          disabled={isProcessingPayout}
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {payouts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No payout history found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};