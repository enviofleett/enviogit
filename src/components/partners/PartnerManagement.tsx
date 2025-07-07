import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  Search,
  Filter,
  Eye,
  Edit,
  Mail,
  Phone,
  MapPin,
  CreditCard
} from 'lucide-react';
import { TechnicalPartnerService } from '@/services/partners/TechnicalPartnerService';

export const PartnerManagement = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    filterPartners();
  }, [partners, selectedStatus, searchTerm]);

  const loadPartners = async () => {
    try {
      setIsLoading(true);
      const partnersData = await TechnicalPartnerService.getAllPartners();
      setPartners(partnersData);
    } catch (error) {
      console.error('Error loading partners:', error);
      toast({
        title: "Error",
        description: "Failed to load partners",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterPartners = () => {
    let filtered = partners;

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(partner => partner.status === selectedStatus);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(partner => 
        partner.name.toLowerCase().includes(term) ||
        partner.email.toLowerCase().includes(term) ||
        partner.phone_number.includes(term) ||
        (partner.city && partner.city.toLowerCase().includes(term))
      );
    }

    setFilteredPartners(filtered);
  };

  const handleStatusUpdate = async (partnerId: string, newStatus: 'approved' | 'rejected' | 'inactive') => {
    try {
      await TechnicalPartnerService.updatePartnerStatus(partnerId, newStatus);
      toast({
        title: "Success",
        description: `Partner status updated to ${newStatus}`,
      });
      loadPartners();
    } catch (error) {
      console.error('Error updating partner status:', error);
      toast({
        title: "Error",
        description: "Failed to update partner status",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      case 'inactive': return 'outline';
      default: return 'secondary';
    }
  };

  const PartnerCard = ({ partner }: { partner: any }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{partner.name}</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                {partner.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3" />
                {partner.phone_number}
              </div>
              {partner.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {partner.city}, {partner.country}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge variant={getStatusColor(partner.status)}>
              {partner.status}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {new Date(partner.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => setSelectedPartner(partner)}>
                <Eye className="h-3 w-3 mr-1" />
                View Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Partner Details: {partner.name}</DialogTitle>
              </DialogHeader>
              <PartnerDetails partner={partner} />
            </DialogContent>
          </Dialog>

          {partner.status === 'pending' && (
            <>
              <Button 
                size="sm" 
                onClick={() => handleStatusUpdate(partner.id, 'approved')}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={() => handleStatusUpdate(partner.id, 'rejected')}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </>
          )}

          {partner.status === 'approved' && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleStatusUpdate(partner.id, 'inactive')}
            >
              Deactivate
            </Button>
          )}

          {partner.status === 'inactive' && (
            <Button 
              size="sm" 
              onClick={() => handleStatusUpdate(partner.id, 'approved')}
            >
              Reactivate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const PartnerDetails = ({ partner }: { partner: any }) => (
    <Tabs defaultValue="basic" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="business">Business Details</TabsTrigger>
        <TabsTrigger value="financial">Financial Info</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <p className="text-sm text-muted-foreground">{partner.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <p className="text-sm text-muted-foreground">{partner.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Phone</label>
            <p className="text-sm text-muted-foreground">{partner.phone_number}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Location</label>
            <p className="text-sm text-muted-foreground">
              {partner.city ? `${partner.city}, ${partner.country}` : 'Not provided'}
            </p>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">NIN</label>
            <p className="text-sm text-muted-foreground">{partner.nin || 'Not provided'}</p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="business" className="space-y-4">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Office Address</label>
            <p className="text-sm text-muted-foreground">
              {partner.office_address || 'Not provided'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Profile Literature</label>
            <p className="text-sm text-muted-foreground">
              {partner.profile_literature || 'Not provided'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Registration Date</label>
            <p className="text-sm text-muted-foreground">
              {new Date(partner.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="financial" className="space-y-4">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Bank Account Information</label>
            {partner.bank_account_info && Object.keys(partner.bank_account_info).length > 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                {Object.entries(partner.bank_account_info).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key.replace('_', ' ')}:</span>
                    <span>{value as string}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not provided</p>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Partner Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search partners by name, email, phone, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total: {partners.length}</span>
            <span>Filtered: {filteredPartners.length}</span>
            <span>Pending: {partners.filter(p => p.status === 'pending').length}</span>
            <span>Active: {partners.filter(p => p.status === 'approved').length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Partners List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                  <div className="h-8 bg-muted rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPartners.length === 0 ? (
        <Alert>
          <AlertDescription>
            {searchTerm || selectedStatus !== 'all' 
              ? 'No partners found matching your filters.' 
              : 'No partners registered yet.'
            }
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPartners.map((partner) => (
            <PartnerCard key={partner.id} partner={partner} />
          ))}
        </div>
      )}
    </div>
  );
};