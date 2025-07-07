import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Monitor, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Search,
  Filter,
  Eye,
  Download,
  RefreshCw,
  MessageSquare,
  Smartphone,
  Command,
  Database
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AuditLog {
  id: string;
  vehicle_id?: string;
  technical_partner_id: string;
  device_id: string;
  command_type: string;
  command_data: any;
  response_data?: any;
  status: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  technical_partners?: {
    name: string;
    email: string;
  };
}

interface SupportRequest {
  id: string;
  technical_partner_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  resolved_at?: string;
  technical_partners?: {
    name: string;
    email: string;
  };
}

export const SupportMonitoring = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<SupportRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [commandFilter, setCommandFilter] = useState('all');
  const { toast } = useToast();

  useEffect(() => {
    loadMonitoringData();
  }, []);

  useEffect(() => {
    filterData();
  }, [auditLogs, supportRequests, searchTerm, statusFilter, commandFilter]);

  const loadMonitoringData = async () => {
    try {
      setIsLoading(true);
      
      // Load audit logs
      const { data: logsData, error: logsError } = await supabase
        .from('command_audit')
        .select(`
          *,
          technical_partners (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Load support requests (mock data for now)
      const mockSupportRequests: SupportRequest[] = [
        {
          id: '1',
          technical_partner_id: 'partner-1',
          subject: 'Device Configuration Issue',
          description: 'Unable to configure SMS settings for OBD tracker',
          status: 'open',
          priority: 'high',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          technical_partners: {
            name: 'John Doe',
            email: 'john@example.com'
          }
        },
        {
          id: '2',
          technical_partner_id: 'partner-2',
          subject: 'Commission Calculation Query',
          description: 'Question about renewal commission rates',
          status: 'in_progress',
          priority: 'medium',
          created_at: new Date(Date.now() - 172800000).toISOString(),
          technical_partners: {
            name: 'Jane Smith',
            email: 'jane@example.com'
          }
        }
      ];

      setAuditLogs(logsData || []);
      setSupportRequests(mockSupportRequests);
    } catch (error) {
      console.error('Error loading monitoring data:', error);
      toast({
        title: "Error",
        description: "Failed to load monitoring data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterData = () => {
    // Filter audit logs
    let filteredLogsData = auditLogs;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredLogsData = filteredLogsData.filter(log => 
        log.device_id.toLowerCase().includes(term) ||
        log.command_type.toLowerCase().includes(term) ||
        log.technical_partners?.name.toLowerCase().includes(term) ||
        log.technical_partners?.email.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filteredLogsData = filteredLogsData.filter(log => log.status === statusFilter);
    }

    if (commandFilter !== 'all') {
      filteredLogsData = filteredLogsData.filter(log => log.command_type === commandFilter);
    }

    setFilteredLogs(filteredLogsData);

    // Filter support requests
    let filteredRequestsData = supportRequests;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredRequestsData = filteredRequestsData.filter(request => 
        request.subject.toLowerCase().includes(term) ||
        request.description.toLowerCase().includes(term) ||
        request.technical_partners?.name.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filteredRequestsData = filteredRequestsData.filter(request => request.status === statusFilter);
    }

    setFilteredRequests(filteredRequestsData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'resolved': return 'default';
      case 'pending':
      case 'open': return 'secondary';
      case 'failed':
      case 'error': return 'destructive';
      case 'in_progress': return 'outline';
      default: return 'secondary';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const AuditLogCard = ({ log }: { log: AuditLog }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Command className="h-4 w-4" />
              <h3 className="font-semibold">{log.command_type}</h3>
              <Badge variant={getStatusColor(log.status)}>
                {log.status}
              </Badge>
            </div>
            
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3 w-3" />
                Device: {log.device_id}
              </div>
              <div className="flex items-center gap-2">
                <Monitor className="h-3 w-3" />
                Partner: {log.technical_partners?.name}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {log.error_message && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {log.error_message}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            <Eye className="h-3 w-3 mr-1" />
            View Details
          </Button>
          
          {log.status === 'failed' && (
            <Button size="sm" variant="outline">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const SupportRequestCard = ({ request }: { request: SupportRequest }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4" />
              <h3 className="font-semibold">{request.subject}</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {request.description}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{request.technical_partners?.name}</span>
              <span>{new Date(request.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 items-end">
            <Badge variant={getStatusColor(request.status)}>
              {request.status.replace('_', ' ')}
            </Badge>
            <Badge variant={getPriorityColor(request.priority)}>
              {request.priority}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          
          {request.status === 'open' && (
            <Button size="sm">
              Assign
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const SystemHealthCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {auditLogs.filter(log => log.status === 'completed').length}
            </div>
            <div className="text-sm text-muted-foreground">Successful Commands</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {auditLogs.filter(log => log.status === 'failed').length}
            </div>
            <div className="text-sm text-muted-foreground">Failed Commands</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {supportRequests.filter(req => req.status === 'open').length}
            </div>
            <div className="text-sm text-muted-foreground">Open Tickets</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {new Set(auditLogs.map(log => log.technical_partner_id)).size}
            </div>
            <div className="text-sm text-muted-foreground">Active Partners</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <SystemHealthCard />

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search logs and requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={commandFilter} onValueChange={setCommandFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Command Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Commands</SelectItem>
                <SelectItem value="sms_config">SMS Config</SelectItem>
                <SelectItem value="engine_stop">Engine Stop</SelectItem>
                <SelectItem value="engine_resume">Engine Resume</SelectItem>
                <SelectItem value="location_request">Location Request</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={loadMonitoringData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="audit" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="support">Support Requests</TabsTrigger>
          <TabsTrigger value="system">System Monitoring</TabsTrigger>
        </TabsList>
        
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Command Audit Trail
                </div>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No audit logs found matching your criteria.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredLogs.map((log) => (
                    <AuditLogCard key={log.id} log={log} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="support">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Support Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRequests.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    No support requests found matching your criteria.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRequests.map((request) => (
                    <SupportRequestCard key={request.id} request={request} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                System Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Advanced system monitoring will be available soon</p>
                <p className="text-sm">Real-time metrics, performance analytics, and system alerts</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};