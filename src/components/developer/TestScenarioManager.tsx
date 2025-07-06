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
  TestTube, 
  Plus, 
  Play, 
  Edit,
  Trash2,
  Users,
  ShoppingCart,
  Smartphone,
  Shield,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  scenario_type: 'customer' | 'merchant' | 'technical_partner' | 'admin';
  test_steps: any[];
  expected_outcomes: any;
  is_active: boolean;
  timeout_seconds: number;
  priority: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface TestResult {
  id: string;
  scenario_id: string;
  status: string;
  execution_time_ms: number;
  completed_at: string;
}

export const TestScenarioManager = () => {
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [recentResults, setRecentResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<TestScenario | null>(null);
  const [newScenario, setNewScenario] = useState({
    name: '',
    description: '',
    scenario_type: 'customer' as const,
    test_steps: '[]',
    expected_outcomes: '{}',
    timeout_seconds: 300,
    priority: 1,
    tags: ''
  });
  const { toast } = useToast();

  const fetchScenarios = async () => {
    try {
      const { data: scenariosData, error: scenariosError } = await supabase
        .from('synthetic_test_scenarios')
        .select('*')
        .order('priority', { ascending: false })
        .order('name');

      if (scenariosError) throw scenariosError;

      setScenarios(scenariosData as TestScenario[] || []);

      // Fetch recent test results
      const { data: resultsData, error: resultsError } = await supabase
        .from('synthetic_test_results')
        .select('id, scenario_id, status, execution_time_ms, completed_at')
        .order('completed_at', { ascending: false })
        .limit(50);

      if (resultsError) throw resultsError;

      setRecentResults(resultsData || []);
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
      toast({
        title: "Error",
        description: "Failed to fetch test scenarios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createScenario = async () => {
    try {
      const { error } = await supabase
        .from('synthetic_test_scenarios')
        .insert({
          name: newScenario.name,
          description: newScenario.description,
          scenario_type: newScenario.scenario_type,
          test_steps: JSON.parse(newScenario.test_steps || '[]'),
          expected_outcomes: JSON.parse(newScenario.expected_outcomes || '{}'),
          timeout_seconds: newScenario.timeout_seconds,
          priority: newScenario.priority,
          tags: newScenario.tags ? newScenario.tags.split(',').map(t => t.trim()) : []
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Test scenario created successfully",
        variant: "default"
      });

      setIsCreateDialogOpen(false);
      setNewScenario({
        name: '',
        description: '',
        scenario_type: 'customer',
        test_steps: '[]',
        expected_outcomes: '{}',
        timeout_seconds: 300,
        priority: 1,
        tags: ''
      });
      fetchScenarios();
    } catch (error) {
      console.error('Failed to create scenario:', error);
      toast({
        title: "Error",
        description: "Failed to create test scenario",
        variant: "destructive"
      });
    }
  };

  const runScenario = async (scenarioId: string) => {
    try {
      const { error } = await supabase.functions.invoke('synthetic-test-runner', {
        body: { 
          run_type: 'manual',
          scenarios: [scenarioId]
        }
      });

      if (error) throw error;

      toast({
        title: "Test Started",
        description: "Scenario test is now running",
        variant: "default"
      });

      // Refresh results after a delay
      setTimeout(fetchScenarios, 2000);
    } catch (error) {
      console.error('Failed to run scenario:', error);
      toast({
        title: "Error",
        description: "Failed to run test scenario",
        variant: "destructive"
      });
    }
  };

  const toggleScenarioStatus = async (scenarioId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('synthetic_test_scenarios')
        .update({ is_active: !isActive })
        .eq('id', scenarioId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Scenario ${!isActive ? 'enabled' : 'disabled'}`,
        variant: "default"
      });

      fetchScenarios();
    } catch (error) {
      console.error('Failed to toggle scenario:', error);
      toast({
        title: "Error",
        description: "Failed to update scenario status",
        variant: "destructive"
      });
    }
  };

  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'customer': return <Users className="h-4 w-4 text-blue-600" />;
      case 'merchant': return <ShoppingCart className="h-4 w-4 text-green-600" />;
      case 'technical_partner': return <Smartphone className="h-4 w-4 text-purple-600" />;
      case 'admin': return <Shield className="h-4 w-4 text-orange-600" />;
      default: return <TestTube className="h-4 w-4" />;
    }
  };

  const getScenarioResults = (scenarioId: string) => {
    return recentResults.filter(r => r.scenario_id === scenarioId).slice(0, 5);
  };

  const getScenarioHealthStatus = (scenarioId: string) => {
    const results = getScenarioResults(scenarioId);
    if (results.length === 0) return 'unknown';
    
    const passedCount = results.filter(r => r.status === 'passed').length;
    const successRate = (passedCount / results.length) * 100;
    
    if (successRate >= 90) return 'healthy';
    if (successRate >= 70) return 'degraded';
    return 'critical';
  };

  useEffect(() => {
    fetchScenarios();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-full"></div>
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
          <h3 className="text-lg font-semibold">Test Scenarios</h3>
          <p className="text-sm text-muted-foreground">
            Manage and execute synthetic user journey tests
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Scenario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Test Scenario</DialogTitle>
              <DialogDescription>
                Define a new synthetic user journey test
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Scenario Name</Label>
                  <Input
                    id="name"
                    value={newScenario.name}
                    onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
                    placeholder="e.g., Customer Registration Flow"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Scenario Type</Label>
                  <Select
                    value={newScenario.scenario_type}
                    onValueChange={(value: any) => setNewScenario({ ...newScenario, scenario_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer Journey</SelectItem>
                      <SelectItem value="merchant">Merchant Journey</SelectItem>
                      <SelectItem value="technical_partner">Technical Partner</SelectItem>
                      <SelectItem value="admin">Admin Operations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newScenario.description}
                  onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
                  placeholder="Describe what this scenario tests..."
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={newScenario.timeout_seconds}
                    onChange={(e) => setNewScenario({ ...newScenario, timeout_seconds: parseInt(e.target.value) || 300 })}
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    max="5"
                    value={newScenario.priority}
                    onChange={(e) => setNewScenario({ ...newScenario, priority: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={newScenario.tags}
                    onChange={(e) => setNewScenario({ ...newScenario, tags: e.target.value })}
                    placeholder="e.g., critical, payment, gps51"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="steps">Test Steps (JSON)</Label>
                <Textarea
                  id="steps"
                  value={newScenario.test_steps}
                  onChange={(e) => setNewScenario({ ...newScenario, test_steps: e.target.value })}
                  placeholder='[{"step": "register", "action": "POST /api/register", "data": {...}}]'
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="outcomes">Expected Outcomes (JSON)</Label>
                <Textarea
                  id="outcomes"
                  value={newScenario.expected_outcomes}
                  onChange={(e) => setNewScenario({ ...newScenario, expected_outcomes: e.target.value })}
                  placeholder='{"registration_success": true, "user_created": true}'
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createScenario}>
                  Create Scenario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Scenarios List */}
      <div className="space-y-4">
        {scenarios.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <TestTube className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Test Scenarios</h3>
              <p className="text-muted-foreground mb-4">
                Create your first synthetic test scenario to start monitoring user journeys
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Scenario
              </Button>
            </CardContent>
          </Card>
        ) : (
          scenarios.map((scenario) => {
            const healthStatus = getScenarioHealthStatus(scenario.id);
            const recentResults = getScenarioResults(scenario.id);
            
            return (
              <Card key={scenario.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getScenarioIcon(scenario.scenario_type)}
                      <div>
                        <CardTitle className="text-lg">{scenario.name}</CardTitle>
                        <CardDescription>{scenario.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={healthStatus === 'healthy' ? 'default' : 
                                   healthStatus === 'degraded' ? 'secondary' : 'destructive'}>
                        {healthStatus}
                      </Badge>
                      <Badge variant={scenario.is_active ? 'default' : 'outline'}>
                        {scenario.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Scenario Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <p className="font-medium capitalize">{scenario.scenario_type.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Priority:</span>
                        <p className="font-medium">{scenario.priority}/5</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timeout:</span>
                        <p className="font-medium">{scenario.timeout_seconds}s</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Steps:</span>
                        <p className="font-medium">{scenario.test_steps.length}</p>
                      </div>
                    </div>

                    {/* Recent Results */}
                    {recentResults.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Recent Results</h4>
                        <div className="flex gap-1">
                          {recentResults.map((result, index) => (
                            <div
                              key={result.id}
                              className={`w-8 h-8 rounded flex items-center justify-center text-xs ${
                                result.status === 'passed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : result.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                              title={`${result.status} - ${result.execution_time_ms}ms - ${new Date(result.completed_at).toLocaleString()}`}
                            >
                              {result.status === 'passed' ? (
                                <CheckCircle className="h-3 w-3" />
                              ) : result.status === 'failed' ? (
                                <XCircle className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {scenario.tags && scenario.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {scenario.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        onClick={() => runScenario(scenario.id)}
                        className="flex items-center gap-1"
                      >
                        <Play className="h-3 w-3" />
                        Run Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleScenarioStatus(scenario.id, scenario.is_active)}
                      >
                        {scenario.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};