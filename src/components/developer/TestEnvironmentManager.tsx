import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Globe,
  Database,
  CreditCard,
  MapPin,
  RefreshCw,
  Edit,
  Trash2
} from 'lucide-react';

interface TestEnvironment {
  id: string;
  name: string;
  description: string;
  environment_type: 'development' | 'test' | 'staging' | 'production';
  base_url: string;
  gps51_config: any;
  paystack_config: any;
  database_config: any;
  is_active: boolean;
  last_health_check: string | null;
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  created_at: string;
  updated_at: string;
}

export const TestEnvironmentManager = () => {
  const [environments, setEnvironments] = useState<TestEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [healthChecking, setHealthChecking] = useState<string | null>(null);
  const [newEnvironment, setNewEnvironment] = useState({
    name: '',
    description: '',
    environment_type: 'test' as const,
    base_url: '',
    gps51_config: '{"test_mode": true, "test_devices": []}',
    paystack_config: '{"sandbox": true, "test_keys": true}',
    database_config: '{"test_database": true}'
  });
  const { toast } = useToast();

  const fetchEnvironments = async () => {
    try {
      const { data, error } = await supabase
        .from('test_environments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEnvironments(data as TestEnvironment[] || []);
    } catch (error) {
      console.error('Failed to fetch environments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch test environments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createEnvironment = async () => {
    try {
      const { error } = await supabase
        .from('test_environments')
        .insert({
          name: newEnvironment.name,
          description: newEnvironment.description,
          environment_type: newEnvironment.environment_type,
          base_url: newEnvironment.base_url,
          gps51_config: JSON.parse(newEnvironment.gps51_config),
          paystack_config: JSON.parse(newEnvironment.paystack_config),
          database_config: JSON.parse(newEnvironment.database_config)
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Test environment created successfully",
        variant: "default"
      });

      setIsCreateDialogOpen(false);
      setNewEnvironment({
        name: '',
        description: '',
        environment_type: 'test',
        base_url: '',
        gps51_config: '{"test_mode": true, "test_devices": []}',
        paystack_config: '{"sandbox": true, "test_keys": true}',
        database_config: '{"test_database": true}'
      });
      fetchEnvironments();
    } catch (error) {
      console.error('Failed to create environment:', error);
      toast({
        title: "Error",
        description: "Failed to create test environment",
        variant: "destructive"
      });
    }
  };

  const runHealthCheck = async (environmentId: string) => {
    setHealthChecking(environmentId);
    try {
      const { data, error } = await supabase.functions.invoke('environment-health-check', {
        body: { environment_id: environmentId }
      });

      if (error) throw error;

      toast({
        title: "Health Check Complete",
        description: `Environment health check completed: ${data.status}`,
        variant: data.status === 'healthy' ? 'default' : 'destructive'
      });

      fetchEnvironments();
    } catch (error) {
      console.error('Failed to run health check:', error);
      toast({
        title: "Error",
        description: "Failed to run environment health check",
        variant: "destructive"
      });
    } finally {
      setHealthChecking(null);
    }
  };

  const toggleEnvironmentStatus = async (environmentId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('test_environments')
        .update({ is_active: !isActive })
        .eq('id', environmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Environment ${!isActive ? 'enabled' : 'disabled'}`,
        variant: "default"
      });

      fetchEnvironments();
    } catch (error) {
      console.error('Failed to toggle environment:', error);
      toast({
        title: "Error",
        description: "Failed to update environment status",
        variant: "destructive"
      });
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Settings className="h-4 w-4 text-gray-600" />;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEnvironmentTypeColor = (type: string) => {
    switch (type) {
      case 'production': return 'bg-red-100 text-red-800 border-red-200';
      case 'staging': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'test': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'development': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  useEffect(() => {
    fetchEnvironments();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-20 bg-muted rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Test Environments</h3>
          <p className="text-sm text-muted-foreground">
            Manage testing environments for synthetic monitoring
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Environment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Test Environment</DialogTitle>
              <DialogDescription>
                Configure a new environment for running synthetic tests
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="env-name">Environment Name</Label>
                  <Input
                    id="env-name"
                    value={newEnvironment.name}
                    onChange={(e) => setNewEnvironment({ ...newEnvironment, name: e.target.value })}
                    placeholder="e.g., Production Test Environment"
                  />
                </div>
                <div>
                  <Label htmlFor="env-type">Environment Type</Label>
                  <Select
                    value={newEnvironment.environment_type}
                    onValueChange={(value: any) => setNewEnvironment({ ...newEnvironment, environment_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="env-description">Description</Label>
                <Textarea
                  id="env-description"
                  value={newEnvironment.description}
                  onChange={(e) => setNewEnvironment({ ...newEnvironment, description: e.target.value })}
                  placeholder="Describe this environment's purpose..."
                />
              </div>
              <div>
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  value={newEnvironment.base_url}
                  onChange={(e) => setNewEnvironment({ ...newEnvironment, base_url: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </div>
              <div>
                <Label htmlFor="gps51-config">GPS51 Configuration (JSON)</Label>
                <Textarea
                  id="gps51-config"
                  value={newEnvironment.gps51_config}
                  onChange={(e) => setNewEnvironment({ ...newEnvironment, gps51_config: e.target.value })}
                  placeholder='{"test_mode": true, "test_devices": ["device1", "device2"]}'
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="paystack-config">Paystack Configuration (JSON)</Label>
                <Textarea
                  id="paystack-config"
                  value={newEnvironment.paystack_config}
                  onChange={(e) => setNewEnvironment({ ...newEnvironment, paystack_config: e.target.value })}
                  placeholder='{"sandbox": true, "test_keys": true}'
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="database-config">Database Configuration (JSON)</Label>
                <Textarea
                  id="database-config"
                  value={newEnvironment.database_config}
                  onChange={(e) => setNewEnvironment({ ...newEnvironment, database_config: e.target.value })}
                  placeholder='{"test_database": true}'
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createEnvironment}>
                  Create Environment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Environments List */}
      <div className="space-y-4">
        {environments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Test Environments</h3>
              <p className="text-muted-foreground mb-4">
                Create your first test environment to start running synthetic tests
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Environment
              </Button>
            </CardContent>
          </Card>
        ) : (
          environments.map((environment) => (
            <Card key={environment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{environment.name}</CardTitle>
                      <CardDescription>{environment.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getEnvironmentTypeColor(environment.environment_type)}>
                      {environment.environment_type}
                    </Badge>
                    <Badge className={getHealthStatusColor(environment.health_status)}>
                      {getHealthStatusIcon(environment.health_status)}
                      {environment.health_status}
                    </Badge>
                    <Badge variant={environment.is_active ? 'default' : 'outline'}>
                      {environment.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Environment Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Base URL</p>
                          <p className="font-mono text-sm">{environment.base_url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">GPS51 Mode</p>
                          <p className="text-sm">
                            {environment.gps51_config?.test_mode ? 'Test Mode' : 'Production Mode'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Paystack Mode</p>
                          <p className="text-sm">
                            {environment.paystack_config?.sandbox ? 'Sandbox' : 'Live'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Database</p>
                          <p className="text-sm">
                            {environment.database_config?.test_database ? 'Test DB' : 'Production DB'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Last Health Check */}
                  {environment.last_health_check && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        Last health check: {new Date(environment.last_health_check).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={() => runHealthCheck(environment.id)}
                      disabled={healthChecking === environment.id}
                      className="flex items-center gap-1"
                    >
                      {healthChecking === environment.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      Health Check
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleEnvironmentStatus(environment.id, environment.is_active)}
                    >
                      {environment.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};