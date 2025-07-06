import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Shield,
  Zap,
  Ban,
  TrendingUp,
  Wifi,
  RefreshCw
} from 'lucide-react';

interface APIHealthMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitHits: number;
  ipBanRisk: 'low' | 'medium' | 'high';
  lastSuccessfulCall: string;
  recentErrors: Array<{
    timestamp: string;
    endpoint: string;
    error: string;
  }>;
}

export function GPS51APIHealthMonitor() {
  const [metrics, setMetrics] = useState<APIHealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [currentIP, setCurrentIP] = useState<string>('Detecting...');
  const [gps51ServerIP, setGPS51ServerIP] = useState<string>('api.gps51.com');

  const loadMetrics = async () => {
    try {
      // Get current client IP
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        setCurrentIP(ipData.ip);
      } catch {
        setCurrentIP('Unable to detect');
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      // Get API call statistics from the last hour
      const { data: apiCalls, error } = await supabase
        .from('api_calls_monitor')
        .select('*')
        .gte('timestamp', oneHourAgo)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error loading API metrics:', error);
        return;
      }

      const gps51Calls = apiCalls?.filter(call => 
        call.endpoint.includes('gps51') || 
        call.endpoint.includes('GPS51')
      ) || [];

      const totalRequests = gps51Calls.length;
      const successfulRequests = gps51Calls.filter(call => call.response_status >= 200 && call.response_status < 300).length;
      const failedRequests = totalRequests - successfulRequests;
      
      const avgResponseTime = gps51Calls.length > 0 
        ? gps51Calls.reduce((sum, call) => sum + (call.duration_ms || 0), 0) / gps51Calls.length
        : 0;

      // Count rate limit errors (status 429 or specific GPS51 rate limit errors)
      const rateLimitHits = gps51Calls.filter(call => 
        call.response_status === 429 || 
        call.error_message?.includes('rate limit') ||
        call.error_message?.includes('8902')
      ).length;

      // Calculate IP ban risk based on failure patterns
      const recentFailures = gps51Calls.filter(call => 
        call.response_status >= 400 && call.timestamp > new Date(Date.now() - 15 * 60 * 1000).toISOString()
      ).length;
      
      let ipBanRisk: 'low' | 'medium' | 'high' = 'low';
      if (recentFailures > 10) ipBanRisk = 'high';
      else if (recentFailures > 5) ipBanRisk = 'medium';

      const lastSuccessful = gps51Calls.find(call => call.response_status >= 200 && call.response_status < 300);
      
      const recentErrors = gps51Calls
        .filter(call => call.error_message)
        .slice(0, 5)
        .map(call => ({
          timestamp: call.timestamp,
          endpoint: call.endpoint,
          error: call.error_message || 'Unknown error'
        }));

      setMetrics({
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: Math.round(avgResponseTime),
        rateLimitHits,
        ipBanRisk,
        lastSuccessfulCall: lastSuccessful?.timestamp || 'Never',
        recentErrors
      });

    } catch (error) {
      console.error('Failed to load GPS51 API metrics:', error);
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    loadMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSuccessRate = () => {
    if (!metrics || metrics.totalRequests === 0) return 0;
    return Math.round((metrics.successfulRequests / metrics.totalRequests) * 100);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'high': return <Ban className="h-4 w-4 text-red-600" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default: return <Shield className="h-4 w-4 text-green-600" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p>Loading GPS51 API health metrics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="text-center p-8">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
          <h3 className="text-lg font-medium mb-2">No API Data Available</h3>
          <p className="text-muted-foreground">No GPS51 API calls recorded in the last hour</p>
        </CardContent>
      </Card>
    );
  }

  const successRate = getSuccessRate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">GPS51 API Health Monitor</h3>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span>Client IP: <code className="bg-muted px-1 rounded">{currentIP}</code></span>
            <span>GPS51 Server: <code className="bg-muted px-1 rounded">{gps51ServerIP}</code></span>
          </div>
        </div>
        <Button 
          onClick={loadMetrics} 
          variant="outline" 
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Critical Alerts */}
      {metrics.ipBanRisk === 'high' && (
        <Alert variant="destructive">
          <Ban className="h-4 w-4" />
          <AlertDescription>
            <strong>High IP Ban Risk Detected!</strong>
            <p className="mt-1">Too many failed requests in the last 15 minutes. Consider pausing API calls to prevent IP blocking.</p>
          </AlertDescription>
        </Alert>
      )}

      {metrics.rateLimitHits > 5 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Multiple Rate Limit Violations</strong>
            <p className="mt-1">{metrics.rateLimitHits} rate limit hits detected. Implement request throttling immediately.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className={`text-2xl font-bold ${successRate >= 95 ? 'text-green-600' : successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {successRate}%
                </p>
              </div>
              <CheckCircle className={`h-8 w-8 ${successRate >= 95 ? 'text-green-600' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
                <p className={`text-2xl font-bold ${metrics.averageResponseTime < 2000 ? 'text-green-600' : metrics.averageResponseTime < 5000 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {metrics.averageResponseTime}ms
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rate Limits</p>
                <p className={`text-2xl font-bold ${metrics.rateLimitHits === 0 ? 'text-green-600' : metrics.rateLimitHits < 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {metrics.rateLimitHits}
                </p>
              </div>
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">IP Ban Risk</p>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold capitalize ${getRiskColor(metrics.ipBanRisk)}`}>
                    {metrics.ipBanRisk}
                  </span>
                  {getRiskIcon(metrics.ipBanRisk)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Request Statistics (Last Hour)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Total Requests</span>
              <span className="font-medium">{metrics.totalRequests}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Successful</span>
              <span className="font-medium text-green-600">{metrics.successfulRequests}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Failed</span>
              <span className="font-medium text-red-600">{metrics.failedRequests}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Success Rate</span>
                <span className="font-medium">{successRate}%</span>
              </div>
              <Progress value={successRate} className="h-2" />
            </div>
            <div className="flex items-center justify-between">
              <span>Last Successful Call</span>
              <span className="font-medium text-xs">
                {metrics.lastSuccessfulCall !== 'Never' 
                  ? new Date(metrics.lastSuccessfulCall).toLocaleTimeString()
                  : 'Never'
                }
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.recentErrors.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm text-muted-foreground">No recent errors</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {metrics.recentErrors.map((error, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{error.endpoint}</p>
                        <p className="text-xs text-muted-foreground">{error.error}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Real-Time Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Real-Time Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Network Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Your IP Address:</span>
                  <code className="bg-muted px-2 py-1 rounded text-green-600 font-mono">{currentIP}</code>
                </div>
                <div className="flex justify-between">
                  <span>GPS51 Server:</span>
                  <code className="bg-muted px-2 py-1 rounded text-blue-600 font-mono">{gps51ServerIP}</code>
                </div>
                <div className="flex justify-between">
                  <span>Connection Type:</span>
                  <span className="text-blue-600">Edge Function Proxy</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Protection Status</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${metrics.rateLimitHits === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">Rate Limiting: {metrics.rateLimitHits === 0 ? 'Clean' : 'Issues Detected'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${successRate >= 90 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm">Connection Quality: {successRate >= 90 ? 'Good' : 'Poor'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${metrics.ipBanRisk === 'low' ? 'bg-green-500' : metrics.ipBanRisk === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className="text-sm">IP Ban Risk: {metrics.ipBanRisk}</span>
                </div>
              </div>
            </div>
          </div>
          
          {metrics.ipBanRisk !== 'low' && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>IP Protection Alert</strong>
                <div className="mt-2 space-y-1 text-sm">
                  <p>• Implement request throttling (max 1 request per 2 seconds)</p>
                  <p>• Add exponential backoff for failed requests</p>
                  <p>• Consider rotating between multiple API endpoints</p>
                  <p>• Monitor authentication failure patterns</p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}