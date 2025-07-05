import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Brain, 
  Loader2,
  Code,
  TrendingUp,
  TrendingDown,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface EdgeFunctionStat {
  id: string;
  function_name: string;
  invocation_time: string;
  execution_duration_ms: number;
  status: 'success' | 'error' | 'timeout';
  error_details: any;
  request_size_bytes?: number;
  response_size_bytes?: number;
  memory_usage_mb?: number;
}

interface FunctionOverview {
  name: string;
  description: string;
  total_invocations: number;
  success_rate: number;
  avg_duration: number;
  last_invocation: string;
  recent_errors: number;
}

const EDGE_FUNCTIONS = [
  {
    name: 'gps51-auth',
    description: 'GPS51 authentication and token management',
  },
  {
    name: 'gps51-proxy',
    description: 'GPS51 API proxy with rate limiting and caching',
  },
  {
    name: 'gps51-sync',
    description: 'Scheduled GPS51 data synchronization',
  },
  {
    name: 'gps51-realtime-ws',
    description: 'Real-time WebSocket connections for GPS data',
  },
  {
    name: 'get-maptiler-key',
    description: 'Secure MapTiler API key retrieval',
  },
  {
    name: 'save-maptiler-key',
    description: 'MapTiler API key storage and validation',
  },
];

export const EdgeFunctionInsights = () => {
  const [stats, setStats] = useState<EdgeFunctionStat[]>([]);
  const [overviews, setOverviews] = useState<FunctionOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingFunction, setAnalyzingFunction] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchFunctionStats();
    generateOverviews();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('edge_function_stats_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'edge_function_stats'
        },
        (payload) => {
          const newStat = payload.new as EdgeFunctionStat;
          setStats(prev => [newStat, ...prev.slice(0, 99)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFunctionStats = async () => {
    try {
      const { data, error } = await supabase
        .from('edge_function_stats')
        .select('*')
        .order('invocation_time', { ascending: false })
        .limit(100);

      if (error) throw error;
      setStats((data || []) as EdgeFunctionStat[]);
    } catch (error) {
      console.error('Error fetching function stats:', error);
      toast.error('Failed to fetch function statistics');
    } finally {
      setLoading(false);
    }
  };

  const generateOverviews = async () => {
    const overviewData: FunctionOverview[] = [];
    
    for (const func of EDGE_FUNCTIONS) {
      const { data, error } = await supabase
        .from('edge_function_stats')
        .select('*')
        .eq('function_name', func.name)
        .order('invocation_time', { ascending: false });

      if (!error && data) {
        const total = data.length;
        const successful = data.filter(s => s.status === 'success').length;
        const recentErrors = data.filter(s => 
          s.status === 'error' && 
          new Date(s.invocation_time) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length;
        
        const avgDuration = total > 0 
          ? data.reduce((sum, s) => sum + (s.execution_duration_ms || 0), 0) / total
          : 0;

        overviewData.push({
          name: func.name,
          description: func.description,
          total_invocations: total,
          success_rate: total > 0 ? (successful / total) * 100 : 0,
          avg_duration: avgDuration,
          last_invocation: data[0]?.invocation_time || '',
          recent_errors: recentErrors,
        });
      }
    }
    
    setOverviews(overviewData);
  };

  const analyzeFunction = async (functionName: string) => {
    setAnalyzingFunction(functionName);
    
    try {
      const recentStats = stats.filter(s => s.function_name === functionName).slice(0, 20);
      
      const response = await supabase.functions.invoke('gemini-analysis', {
        body: {
          type: 'function_analysis',
          data: {
            function_name: functionName,
            recent_stats: recentStats,
            context: 'Edge function performance and health analysis'
          }
        }
      });

      if (response.error) throw response.error;
      
      const analysisResult = response.data?.analysis || 'No analysis available';
      setAnalysis(prev => ({ ...prev, [functionName]: analysisResult }));
      toast.success('Function analysis completed');
    } catch (error) {
      console.error('Error analyzing function:', error);
      toast.error('Failed to analyze function');
    } finally {
      setAnalyzingFunction(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-warning" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'timeout':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading function insights...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Function Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {overviews.map((overview) => (
          <Card key={overview.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{overview.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {overview.total_invocations} calls
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {overview.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Success Rate</span>
                <span className="text-xs font-medium">
                  {overview.success_rate.toFixed(1)}%
                </span>
              </div>
              <Progress value={overview.success_rate} className="h-2" />
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Avg Duration</span>
                  <div className="font-medium">{overview.avg_duration.toFixed(0)}ms</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Recent Errors</span>
                  <div className="font-medium flex items-center">
                    {overview.recent_errors}
                    {overview.recent_errors > 0 ? (
                      <TrendingUp className="w-3 h-3 ml-1 text-destructive" />
                    ) : (
                      <TrendingDown className="w-3 h-3 ml-1 text-success" />
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => analyzeFunction(overview.name)}
                  disabled={analyzingFunction === overview.name}
                  className="text-xs"
                >
                  {analyzingFunction === overview.name ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="w-3 h-3 mr-1" />
                      Analyze
                    </>
                  )}
                </Button>
                
                {overview.last_invocation && (
                  <span className="text-xs text-muted-foreground">
                    Last: {new Date(overview.last_invocation).toLocaleTimeString()}
                  </span>
                )}
              </div>
              
              {analysis[overview.name] && (
                <div className="mt-4 p-3 bg-muted rounded text-xs">
                  <div className="flex items-center mb-2">
                    <Brain className="w-3 h-3 mr-1" />
                    <span className="font-medium">AI Analysis:</span>
                  </div>
                  <div>{analysis[overview.name]}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Function Invocations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Recent Function Invocations</span>
          </CardTitle>
          <CardDescription>
            Real-time function execution monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No function invocations recorded yet
              </div>
            ) : (
              stats.slice(0, 20).map((stat) => (
                <div key={stat.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(stat.status)}
                    <div>
                      <div className="font-medium text-sm">{stat.function_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(stat.invocation_time).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <Badge variant={getStatusBadgeVariant(stat.status)} className="text-xs">
                      {stat.status}
                    </Badge>
                    
                    {stat.execution_duration_ms && (
                      <div className="text-xs text-muted-foreground">
                        {stat.execution_duration_ms}ms
                      </div>
                    )}
                    
                    {stat.memory_usage_mb && (
                      <div className="text-xs text-muted-foreground">
                        {stat.memory_usage_mb.toFixed(1)}MB
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};