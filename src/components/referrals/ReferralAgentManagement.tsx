import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Plus, 
  Edit, 
  Eye, 
  MoreVertical,
  UserCheck,
  UserX
} from 'lucide-react';
import { ReferralAgentService, type ReferralAgent, type NewReferralAgent } from '@/services/referrals/ReferralAgentService';
import { useToast } from '@/hooks/use-toast';

export const ReferralAgentManagement = () => {
  const [agents, setAgents] = useState<ReferralAgent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<ReferralAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<ReferralAgent | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState<NewReferralAgent>({
    name: '',
    email: '',
    phone_number: '',
    bank_account_info: {
      bank_name: '',
      account_name: '',
      account_number: ''
    }
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    // Filter agents based on search query
    if (searchQuery.trim() === '') {
      setFilteredAgents(agents);
    } else {
      const filtered = agents.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.phone_number.includes(searchQuery)
      );
      setFilteredAgents(filtered);
    }
  }, [searchQuery, agents]);

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      const agentsData = await ReferralAgentService.getAllAgents();
      setAgents(agentsData);
      setFilteredAgents(agentsData);
    } catch (error) {
      console.error('Error loading agents:', error);
      toast({
        title: "Error",
        description: "Failed to load referral agents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    try {
      await ReferralAgentService.createAgent(newAgent);
      toast({
        title: "Success",
        description: "Referral agent created successfully",
      });
      setIsCreateDialogOpen(false);
      setNewAgent({
        name: '',
        email: '',
        phone_number: '',
        bank_account_info: {
          bank_name: '',
          account_name: '',
          account_number: ''
        }
      });
      loadAgents();
    } catch (error) {
      console.error('Error creating agent:', error);
      toast({
        title: "Error",
        description: "Failed to create referral agent",
        variant: "destructive",
      });
    }
  };

  const handleStatusToggle = async (agentId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await ReferralAgentService.updateAgentStatus(agentId, newStatus);
      toast({
        title: "Success",
        description: `Agent ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      });
      loadAgents();
    } catch (error) {
      console.error('Error updating agent status:', error);
      toast({
        title: "Error",
        description: "Failed to update agent status",
        variant: "destructive",
      });
    }
  };

  const viewAgentDetails = async (agent: ReferralAgent) => {
    try {
      const agentDetails = await ReferralAgentService.getAgentById(agent.id);
      const commissionSummary = await ReferralAgentService.getAgentCommissionSummary(agent.id);
      
      setSelectedAgent({
        ...agentDetails!,
        ...commissionSummary
      } as any);
      setIsDetailDialogOpen(true);
    } catch (error) {
      console.error('Error loading agent details:', error);
      toast({
        title: "Error",
        description: "Failed to load agent details",
        variant: "destructive",
      });
    }
  };

  const maskAccountNumber = (accountNumber: string) => {
    if (!accountNumber || accountNumber.length < 4) return accountNumber;
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
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
              <CardTitle>Referral Agents</CardTitle>
              <p className="text-muted-foreground">Manage referral agents and their information</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Referral Agent</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={newAgent.name}
                      onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newAgent.email}
                        onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                        placeholder="Enter email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={newAgent.phone_number}
                        onChange={(e) => setNewAgent({ ...newAgent, phone_number: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Bank Account Information</h4>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input
                          id="bankName"
                          value={newAgent.bank_account_info.bank_name}
                          onChange={(e) => setNewAgent({
                            ...newAgent,
                            bank_account_info: { ...newAgent.bank_account_info, bank_name: e.target.value }
                          })}
                          placeholder="Enter bank name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="accountName">Account Name</Label>
                          <Input
                            id="accountName"
                            value={newAgent.bank_account_info.account_name}
                            onChange={(e) => setNewAgent({
                              ...newAgent,
                              bank_account_info: { ...newAgent.bank_account_info, account_name: e.target.value }
                            })}
                            placeholder="Enter account name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="accountNumber">Account Number</Label>
                          <Input
                            id="accountNumber"
                            value={newAgent.bank_account_info.account_number}
                            onChange={(e) => setNewAgent({
                              ...newAgent,
                              bank_account_info: { ...newAgent.bank_account_info, account_number: e.target.value }
                            })}
                            placeholder="Enter account number"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateAgent}>Create Agent</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Referral Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Earned</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{agent.email}</div>
                      <div className="text-muted-foreground">{agent.phone_number}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm">{agent.referral_code}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell>₦{(agent.total_earned || 0).toLocaleString()}</TableCell>
                  <TableCell>₦{(agent.pending_payout || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewAgentDetails(agent)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusToggle(agent.id, agent.status)}
                      >
                        {agent.status === 'active' ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAgents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No agents found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Agent Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agent Details</DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedAgent.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge variant={selectedAgent.status === 'active' ? 'default' : 'secondary'}>
                    {selectedAgent.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p>{selectedAgent.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                  <p>{selectedAgent.phone_number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Referral Code</Label>
                  <code className="bg-muted px-2 py-1 rounded text-sm">{selectedAgent.referral_code}</code>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Registration Date</Label>
                  <p>{new Date(selectedAgent.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              
              {selectedAgent.bank_account_info && (
                <div>
                  <h4 className="font-medium mb-3">Bank Account Details</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Bank Name</Label>
                      <p>{selectedAgent.bank_account_info.bank_name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Account Name</Label>
                      <p>{selectedAgent.bank_account_info.account_name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Account Number</Label>
                      <p>{maskAccountNumber(selectedAgent.bank_account_info.account_number)}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="font-medium mb-3">Performance Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-600">
                        ₦{(selectedAgent.total_earned || 0).toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">Total Earned</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-orange-600">
                        ₦{(selectedAgent.pending_payout || 0).toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">Pending Payout</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};