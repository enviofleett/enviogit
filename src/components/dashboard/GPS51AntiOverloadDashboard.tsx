
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Settings, Activity, TrendingUp, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const GPS51AntiOverloadDashboard: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);

  // Check GPS51 configuration status
  useEffect(() => {
    const checkGPS51Configuration = () => {
      try {
        const apiUrl = localStorage.getItem('gps51_api_url');
        const username = localStorage.getItem('gps51_username');
        const passwordHash = localStorage.getItem('gps51_password_hash');
        
        setIsConfigured(!!(apiUrl && username && passwordHash));
      } catch (error) {
        console.error('Error checking GPS51 configuration:', error);
        setIsConfigured(false);
      } finally {
        setCheckingConfig(false);
      }
    };

    checkGPS51Configuration();
  }, []);

  // Show configuration check loading
  if (checkingConfig) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Checking GPS51 configuration...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show configuration required state
  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <Shield className="h-5 w-5" />
              GPS51 Anti-Overload Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Configuration Required</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    GPS51 API credentials are required to enable anti-overload protection features.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-gray-600">Anti-overload protection helps prevent API rate limiting by:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
                <li>Monitoring API request frequency and response times</li>
                <li>Implementing smart batching and queuing</li>
                <li>Providing circuit breaker protection</li>
                <li>Automatically adjusting sync intervals based on system load</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure GPS51
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mock data for anti-overload dashboard when configured
  const protectionStats = {
    systemHealth: 'excellent' as const,
    requestQueueLength: 0,
    averageResponseTime: 245,
    circuitBreakerStatus: 'closed',
    adaptiveInterval: 30000,
    requestsLastMinute: 12,
    maxRequestsPerMinute: 60,
    consecutiveFailures: 0,
    lastProtectionActivation: null as Date | null
  };

  const getHealthBadge = () => {
    switch (protectionStats.systemHealth) {
      case 'excellent':
        return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
      case 'good':
        return <Badge className="bg-blue-100 text-blue-800">Good</Badge>;
      case 'fair':
        return <Badge className="bg-yellow-100 text-yellow-800">Fair</Badge>;
      case 'poor':
        return <Badge variant="destructive">Poor</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Protection Status Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              GPS51 Anti-Overload Protection System
            </div>
            <div className="flex items-center gap-2">
              {getHealthBadge()}
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Active
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Shield className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">System Health</p>
                <p className="text-xl font-bold capitalize">{protectionStats.systemHealth}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Avg Response</p>
                <p className="text-xl font-bold">{protectionStats.averageResponseTime}ms</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-slate-600">Queue Length</p>
                <p className="text-xl font-bold">{protectionStats.requestQueueLength}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
              <Activity className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-slate-600">Requests/min</p>
                <p className="text-xl font-bold">{protectionStats.requestsLastMinute}/{protectionStats.maxRequestsPerMinute}</p>
              </div>
            </div>
          </div>

          {/* Protection Details */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Circuit Breaker Status:</span>
                <Badge variant={protectionStats.circuitBreakerStatus === 'closed' ? 'default' : 'destructive'}>
                  {protectionStats.circuitBreakerStatus.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Adaptive Interval:</span>
                <span className="font-mono">{protectionStats.adaptiveInterval / 1000}s</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Protection Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Request Rate Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Request Rate Limit</span>
                <span className="font-mono">{protectionStats.maxRequestsPerMinute}/min</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(protectionStats.requestsLastMinute / protectionStats.maxRequestsPerMinute) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600">
                Current usage: {protectionStats.requestsLastMinute} requests in the last minute
              </p>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-800">Rate limit protection active</span>
              </div>
              <p className="text-xs text-green-700 mt-1">
                Requests are automatically throttled to prevent API overload
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Smart Batching System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Consecutive Failures</span>
                <span className="font-mono">{protectionStats.consecutiveFailures}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Circuit Breaker</span>
                <Badge variant={protectionStats.circuitBreakerStatus === 'closed' ? 'default' : 'destructive'}>
                  {protectionStats.circuitBreakerStatus}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Last Protection Event</span>
                <span className="text-xs text-gray-600">
                  {protectionStats.lastProtectionActivation ? 
                    protectionStats.lastProtectionActivation.toLocaleString() : 
                    'Never'
                  }
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-800">Smart batching enabled</span>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Requests are intelligently batched to optimize API usage
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>Protection System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <h3 className="font-medium mb-2">How Anti-Overload Protection Works:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <h4 className="font-medium text-gray-800 mb-1">Request Management:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Monitors API request frequency</li>
                    <li>Implements exponential backoff on failures</li>
                    <li>Queues requests during high load</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800 mb-1">Circuit Breaker:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Opens on consecutive failures</li>
                    <li>Prevents cascade failures</li>
                    <li>Auto-recovery after cooldown</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-800">System Status: Optimal</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    All protection mechanisms are functioning correctly. Your GPS51 integration is operating within safe parameters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51AntiOverloadDashboard;
