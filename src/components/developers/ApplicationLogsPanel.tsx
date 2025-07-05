import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Info, AlertCircle, Search, Brain, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details: any;
  source?: string;
}

export const ApplicationLogsPanel = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [analyzingLog, setAnalyzingLog] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchLogs();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('app_logs_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_logs'
        },
        (payload) => {
          const newLog = payload.new as LogEntry;
          setLogs(prev => [newLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('app_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs((data || []) as LogEntry[]);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch application logs');
    } finally {
      setLoading(false);
    }
  };

  const analyzeLogs = async (logId: string, message: string, details: any) => {
    setAnalyzingLog(logId);
    
    try {
      const response = await supabase.functions.invoke('gemini-analysis', {
        body: {
          type: 'error_analysis',
          data: {
            message,
            details,
            context: 'Fleet management application error analysis'
          }
        }
      });

      if (response.error) throw response.error;
      
      const analysisResult = response.data?.analysis || 'No analysis available';
      setAnalysis(prev => ({ ...prev, [logId]: analysisResult }));
      toast.success('Error analysis completed');
    } catch (error) {
      console.error('Error analyzing log:', error);
      toast.error('Failed to analyze error');
    } finally {
      setAnalyzingLog(null);
    }
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'WARN':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'INFO':
        return <Info className="w-4 h-4 text-info" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLogBadgeVariant = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'destructive';
      case 'WARN':
        return 'secondary';
      case 'INFO':
        return 'default';
      default:
        return 'outline';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.source?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading application logs...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Application Logs</span>
          </CardTitle>
          <CardDescription>
            Real-time application logs with AI-powered error analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="ERROR">Errors Only</SelectItem>
                <SelectItem value="WARN">Warnings Only</SelectItem>
                <SelectItem value="INFO">Info Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs found matching your filters
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                const hasAnalysis = analysis[log.id];
                
                return (
                  <Card key={log.id} className="border-l-4 border-l-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <button
                              onClick={() => toggleLogExpansion(log.id)}
                              className="flex items-center hover:bg-muted rounded p-1"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            {getLogIcon(log.level)}
                            <Badge variant={getLogBadgeVariant(log.level)}>
                              {log.level}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            {log.source && (
                              <Badge variant="outline" className="text-xs">
                                {log.source}
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm font-medium mb-2">{log.message}</p>
                          
                          {isExpanded && (
                            <div className="mt-4 space-y-4">
                              {log.details && Object.keys(log.details).length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2">Details:</h4>
                                  <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                              
                              {hasAnalysis && (
                                <div>
                                  <h4 className="text-sm font-medium mb-2 flex items-center">
                                    <Brain className="w-4 h-4 mr-1" />
                                    AI Analysis:
                                  </h4>
                                  <div className="bg-muted p-3 rounded text-sm">
                                    {hasAnalysis}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {log.level === 'ERROR' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => analyzeLogs(log.id, log.message, log.details)}
                            disabled={analyzingLog === log.id}
                          >
                            {analyzingLog === log.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Brain className="w-4 h-4 mr-1" />
                                Analyze Error
                              </>
                            )}
                          </Button>
                        )}
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