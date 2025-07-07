import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Filter, 
  Download,
  Calendar
} from 'lucide-react';
import { ReferralCommissionService } from '@/services/referrals/ReferralCommissionService';
import { ReferralAgentService } from '@/services/referrals/ReferralAgentService';
import { useToast } from '@/hooks/use-toast';

export const ReferralCommissionTracking = () => {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    agentId: '',
    status: '',
    commissionType: '',
    startDate: '',
    endDate: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadCommissions();
  }, [filters]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [commissionsData, agentsData] = await Promise.all([
        ReferralCommissionService.getAllCommissions(),
        ReferralAgentService.getAllAgents()
      ]);
      
      setCommissions(commissionsData);
      setAgents(agentsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load commission data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCommissions = async () => {
    try {
      const filteredCommissions = await ReferralCommissionService.getFilteredCommissions(filters);
      setCommissions(filteredCommissions);
    } catch (error) {
      console.error('Error loading filtered commissions:', error);
      toast({
        title: "Error",
        description: "Failed to filter commissions",
        variant: "destructive",
      });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      agentId: '',
      status: '',
      commissionType: '',
      startDate: '',
      endDate: ''
    });
  };

  const exportCommissions = () => {
    // Create CSV content
    const headers = ['Date', 'Agent', 'Commission Type', 'Amount', 'Commission Rate', 'Commission Amount', 'Status'];
    const csvContent = [
      headers.join(','),
      ...commissions.map(commission => [
        new Date(commission.created_at).toLocaleDateString(),
        commission.referring_agents?.name || 'N/A',
        commission.commission_type,
        `₦${parseFloat(commission.amount).toLocaleString()}`,
        `${commission.percentage_applied}%`,
        `₦${parseFloat(commission.amount).toLocaleString()}`,
        commission.payout_status
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Commission data exported successfully",
    });
  };

  const getCommissionTypeColor = (type: string) => {
    switch (type) {
      case 'subscription_upgrade':
        return 'bg-blue-100 text-blue-800';
      case 'marketplace_purchase':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Commission Tracking</CardTitle>
              <p className="text-muted-foreground">Track and manage all referral commissions</p>
            </div>
            <Button onClick={exportCommissions}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid gap-4 mb-6 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={filters.agentId} onValueChange={(value) => handleFilterChange('agentId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All agents</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Commission Type</Label>
              <Select value={filters.commissionType} onValueChange={(value) => handleFilterChange('commissionType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="subscription_upgrade">Subscription Upgrade</SelectItem>
                  <SelectItem value="marketplace_purchase">Marketplace Purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-muted-foreground">
              Showing {commissions.length} commission{commissions.length !== 1 ? 's' : ''}
            </div>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Commission Type</TableHead>
                <TableHead>Base Amount</TableHead>
                <TableHead>Commission Rate</TableHead>
                <TableHead>Commission Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((commission) => (
                <TableRow key={commission.id}>
                  <TableCell>
                    {new Date(commission.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{commission.referring_agents?.name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">{commission.referring_agents?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getCommissionTypeColor(commission.commission_type)}>
                      {commission.commission_type.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>₦{parseFloat(commission.amount).toLocaleString()}</TableCell>
                  <TableCell>{commission.percentage_applied}%</TableCell>
                  <TableCell className="font-medium">
                    ₦{parseFloat(commission.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(commission.payout_status)}>
                      {commission.payout_status.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {commissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No commissions found
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