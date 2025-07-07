import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  Wallet,
  Car,
  Settings
} from 'lucide-react';
import { TechnicalPartnerService } from '@/services/partners/TechnicalPartnerService';
import { PartnerWalletService } from '@/services/partners/PartnerWalletService';

export const TechnicalPartnerAdminPanel = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [partnersData, payoutsData] = await Promise.all([
        TechnicalPartnerService.getAllPartners(selectedStatus),
        PartnerWalletService.getAllPayoutRequests()
      ]);
      setPartners(partnersData);
      setPayoutRequests(payoutsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load partner data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (partnerId: string, newStatus: 'approved' | 'rejected' | 'inactive') => {
    try {
      await TechnicalPartnerService.updatePartnerStatus(partnerId, newStatus);
      toast({
        title: "Success",
        description: `Partner status updated to ${newStatus}`,
      });
      loadData();
    } catch (error) {
      console.error('Error updating partner status:', error);
      toast({
        title: "Error",
        description: "Failed to update partner status",
        variant: "destructive",
      });
    }
  };

  const handleApprovePayout = async (requestId: string) => {
    try {
      await PartnerWalletService.approvePayoutRequest(requestId, 'admin-user-id');
      toast({
        title: "Success",
        description: "Payout approved and processed",
      });
      loadData();
    } catch (error) {
      console.error('Error approving payout:', error);
      toast({
        title: "Error",
        description: "Failed to approve payout",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Technical Partner Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {['pending', 'approved', 'rejected', 'inactive'].map(status => (
              <Button
                key={status}
                variant={selectedStatus === status ? 'default' : 'outline'}
                onClick={() => setSelectedStatus(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-4">Loading partners...</div>
          ) : partners.length === 0 ? (
            <Alert>
              <AlertDescription>No partners found with status: {selectedStatus}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {partners.map((partner) => (
                <Card key={partner.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{partner.name}</h3>
                        <p className="text-sm text-muted-foreground">{partner.email}</p>
                        <p className="text-sm text-muted-foreground">{partner.phone_number}</p>
                        <p className="text-sm text-muted-foreground">{partner.city}, {partner.country}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Badge variant={
                          partner.status === 'approved' ? 'default' :
                          partner.status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {partner.status}
                        </Badge>
                        {partner.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => handleStatusUpdate(partner.id, 'approved')}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate(partner.id, 'rejected')}>
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payout Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payoutRequests.length === 0 ? (
            <Alert>
              <AlertDescription>No payout requests pending approval</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {payoutRequests.filter(req => req.status === 'pending').map((request) => (
                <Card key={request.id}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">₦{parseFloat(request.amount).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.technical_partners?.name} - {request.technical_partners?.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested: {new Date(request.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button onClick={() => handleApprovePayout(request.id)}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve Payout
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};