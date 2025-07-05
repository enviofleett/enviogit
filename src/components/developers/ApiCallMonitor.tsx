import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Globe, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Brain, 
  Loader2,
  Search,
  TrendingUp,
  Activity,
  Zap,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

interface ApiCall {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  request_payload: any;
  response_status: number;
  response_body: any;
  duration_ms: number;
  error_message?: string;
}

interface ApiStats {
  total_calls: number;
  success_rate: number;
  avg_duration: number;
  rate_limited_calls: number;
  error_calls: number;
}

export const ApiCallMonitor = () => {
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([]);
  const [stats, setStats] = useState<ApiStats>({
    total_calls: 0,
    success_rate: 0,
    avg_duration: 0,
    rate_limited_calls: 0,
    error_calls: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [analyzingCall, setAnalyzingCall] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchApiCalls();
    calculateStats();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('api_calls_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'api_calls_monitor'
        },
        (payload) => {
          const newCall = payload.new as ApiCall;
          setApiCalls(prev => [newCall, ...prev.slice(0, 99)]);
          calculateStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchApiCalls = async () => {
    try {
      const { data, error } = await supabase
        .from('api_calls_monitor')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setApiCalls(data || []);
    } catch (error) {
      console.error('Error fetching API calls:', error);
      toast.error('Failed to fetch API call data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async () => {
    try {
      const { data, error } = await supabase
        .from('api_calls_monitor')
        .select('response_status, duration_ms, response_body')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      
      const calls = data || [];
      const total = calls.length;
      const successful = calls.filter(c => c.response_status >= 200 && c.response_status < 300).length;
      const rateLimited = calls.filter(c => 
        c.response_status === 8902 || 
        (c.response_body && typeof c.response_body === 'object' && 'status' in c.response_body && c.response_body.status === 8902)
      ).length;
      const errors = calls.filter(c => c.response_status >= 400 || c.response_status === 8902).length;
      const avgDuration = total > 0 
        ? calls.reduce((sum, c) => sum + (c.duration_ms || 0), 0) / total
        : 0;

      setStats({
        total_calls: total,
        success_rate: total > 0 ? (successful / total) * 100 : 0,
        avg_duration: avgDuration,
        rate_limited_calls: rateLimited,
        error_calls: errors,
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const analyzeApiCall = async (callId: string, requestPayload: any, responseBody: any) => {
    setAnalyzingCall(callId);
    
    try {
      const response = await supabase.functions.invoke('gemini-analysis', {
        body: {
          type: 'api_call_analysis',
          data: {
            request: requestPayload,
            response: responseBody,
            context: 'GPS51 API call analysis and translation'
          }
        }
      });

      if (response.error) throw response.error;
      
      const analysisResult = response.data?.analysis || 'No analysis available';
      setAnalysis(prev => ({ ...prev, [callId]: analysisResult }));
      toast.success('API call analysis completed');
    } catch (error) {
      console.error('Error analyzing API call:', error);
      toast.error('Failed to analyze API call');
    } finally {
      setAnalyzingCall(null);
    }
  };

  const toggleCallExpansion = (callId: string) => {
    setExpandedCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return <Badge variant="default" className="bg-success">Success</Badge>;
    } else if (status === 8902) {
      return <Badge variant="destructive">Rate Limited</Badge>;
    } else if (status >= 400) {
      return <Badge variant="destructive">Error</Badge>;
    } else {
      return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getEndpointAction = (payload: any): string => {
    if (payload?.action) return payload.action;
    if (payload?.cmd) return payload.cmd;
    return 'unknown';
  };

  const filteredCalls = apiCalls.filter(call => {
    const matchesSearch = call.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getEndpointAction(call.request_payload).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'success' && call.response_status >= 200 && call.response_status < 300) ||
                         (statusFilter === 'error' && (call.response_status >= 400 || call.response_status === 8902)) ||
                         (statusFilter === 'rate_limited' && call.response_status === 8902);
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading API call monitor...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-primary" />
              <div className="text-2xl font-bold">{stats.total_calls}</div>
            </div>
            <p className="text-xs text-muted-foreground">Total Calls (24h)</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-success" />
              <div className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</div>
            </div>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-warning" />
              <div className="text-2xl font-bold">{stats.avg_duration.toFixed(0)}ms</div>
            </div>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-destructive" />
              <div className="text-2xl font-bold">{stats.rate_limited_calls}</div>
            </div>
            <p className="text-xs text-muted-foreground">Rate Limited</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <div className="text-2xl font-bold">{stats.error_calls}</div>
            </div>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* API Calls List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5" />
            <span>GPS51 API Call Monitor</span>
          </CardTitle>
          <CardDescription>
            Real-time monitoring of GPS51 API interactions with AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search API calls..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success Only</SelectItem>
                <SelectItem value="error">Errors Only</SelectItem>
                <SelectItem value="rate_limited">Rate Limited</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredCalls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No API calls found matching your filters
              </div>
            ) : (
              filteredCalls.map((call) => {
                const isExpanded = expandedCalls.has(call.id);
                const hasAnalysis = analysis[call.id];
                const action = getEndpointAction(call.request_payload);
                
                return (
                  <Card key={call.id} className="border-l-4 border-l-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <button
                              onClick={() => toggleCallExpansion(call.id)}
                              className="flex items-center hover:bg-muted rounded p-1"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            
                            {getStatusBadge(call.response_status)}
                            
                            <Badge variant="outline" className="text-xs">
                              {call.method}
                            </Badge>
                            
                            <Badge variant="secondary" className="text-xs">
                              {action}
                            </Badge>
                            
                            <span className="text-sm text-muted-foreground">
                              {new Date(call.timestamp).toLocaleString()}
                            </span>
                            
                            {call.duration_ms && (
                              <span className="text-xs text-muted-foreground">
                                {call.duration_ms}ms
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm font-medium mb-2">
                            {call.endpoint}
                          </p>
                          
                          {isExpanded && (
                            <div className="mt-4 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Request Payload:</h4>
                                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify(call.request_payload, null, 2)}
                                  </pre>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Response Body:</h4>
                                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                                    {JSON.stringify(call.response_body, null, 2)}
                                  </pre>
                                </div>
                              </div>
                              
                              {call.error_message && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2 text-destructive">Error:</h4>
                                  <div className="bg-destructive/10 p-3 rounded text-sm">
                                    {call.error_message}
                                  </div>
                                </div>
                              )}
                              
                              {hasAnalysis && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2 flex items-center">
                                    <Brain className="w-4 h-4 mr-1" />
                                    AI Translation:
                                  </h4>
                                  <div className="bg-muted p-3 rounded text-sm">
                                    {hasAnalysis}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => analyzeApiCall(call.id, call.request_payload, call.response_body)}
                          disabled={analyzingCall === call.id}
                        >
                          {analyzingCall === call.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Brain className="w-4 h-4 mr-1" />
                              Translate
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};