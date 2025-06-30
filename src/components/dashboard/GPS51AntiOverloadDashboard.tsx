
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Pause, 
  Play,
  Settings,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';
import { useGPS51SmartSync } from '@/hooks/useGPS51SmartSync';
import { gps51RequestManager } from '@/services/gps51/GPS51RequestManager';

const GPS51AntiOverloadDashboard: React.FC = () => {
  const { status, forceSync, emergencyPause, emergencyResume, adjustRateLimit, isRunning } = useGPS51SmartSync(true);
  const [requestManagerHealth, setRequestManagerHealth] = useState(gps51RequestManager.getHealthStatus());
  const [showSettings, setShowSettings] = useState(false);
  const [rateSettings, setRateSettings] = useState({
    maxRequestsPerMinute: 20,
    minDelayBetweenRequests: 3000
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRequestManagerHealth(gps51RequestManager.getHealthStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getSystemHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSystemHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent': return <CheckCircle className="h-4 w-4" />;
      case 'good': return <TrendingUp className="h-4 w-4" />;
      case 'fair': return <TrendingDown className="h-4 w-4" />;
      case 'poor': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const formatInterval = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const handleRateSettingsSubmit = () => {
    adjustRateLimit(rateSettings.maxRequestsPerMinute, rateSettings.minDelayBetweenRequests);
    setShowSettings(false);
  };

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              GPS51 Anti-Overload Protection
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getSystemHealthColor(status.systemHealth)}>
                {getSystemHealthIcon(status.systemHealth)}
                {status.systemHealth.toUpperCase()}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Activity className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Request Queue</p>
                <p className="text-2xl font-bold">{status.requestQueueLength}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Clock className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">Adaptive Interval</p>
                <p className="text-2xl font-bold">{formatInterval(status.adaptiveInterval)}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-slate-600">Success Rate</p>
                <p className="text-2xl font-bold">
                  {requestManagerHealth.consecutiveFailures === 0 ? '100%' : 
                   `${Math.max(0, 100 - (requestManagerHealth.consecutiveFailures * 20))}%`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
              <Shield className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-slate-600">Circuit Breaker</p>
                <p className="text-lg font-bold">
                  {requestManagerHealth.circuitBreakerOpen ? 'OPEN' : 'CLOSED'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Protection Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rate Limiting Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Requests per Minute</span>
              <span className="text-sm">{requestManagerHealth.requestsPerMinute}/20</span>
            </div>
            <Progress value={(requestManagerHealth.requestsPerMinute / 20) * 100} className="h-2" />
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Active Requests</span>
              <span className="text-sm">{requestManagerHealth.activeRequests}/3</span>
            </div>
            <Progress value={(requestManagerHealth.activeRequests / 3) * 100} className="h-2" />
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Backoff Delay</span>
              <span className="text-sm">{formatInterval(requestManagerHealth.backoffDelay)}</span>
            </div>
            <Progress value={Math.min((requestManagerHealth.backoffDelay / 60000) * 100, 100)} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Last Sync</span>
                <span className="text-sm font-medium">
                  {status.lastSync ? status.lastSync.toLocaleTimeString() : 'Never'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Execution Time</span>
                <span className="text-sm font-medium">{status.executionTime}ms</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Devices Found</span>
                <span className="text-sm font-medium">{status.devicesFound}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Positions Stored</span>
                <span className="text-sm font-medium">{status.positionsStored}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm">Consecutive Failures</span>
                <span className="text-sm font-medium">{requestManagerHealth.consecutiveFailures}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={forceSync}
              disabled={isRunning}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Activity className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Syncing...' : 'Force Sync'}
            </Button>
            
            <Button
              onClick={emergencyPause}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Emergency Pause
            </Button>
            
            <Button
              onClick={emergencyResume}
              variant="default"
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Resume Operations
            </Button>
            
            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Rate Settings
            </Button>
          </div>

          {showSettings && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
              <h4 className="font-medium">Rate Limiting Configuration</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Max Requests per Minute</label>
                  <input
                    type="number"
                    value={rateSettings.maxRequestsPerMinute}
                    onChange={(e) => setRateSettings({
                      ...rateSettings,
                      maxRequestsPerMinute: parseInt(e.target.value) || 20
                    })}
                    className="w-full px-3 py-2 border rounded-md"
                    min="5"
                    max="100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Min Delay Between Requests (ms)</label>
                  <input
                    type="number"
                    value={rateSettings.minDelayBetweenRequests}
                    onChange={(e) => setRateSettings({
                      ...rateSettings,
                      minDelayBetweenRequests: parseInt(e.target.value) || 3000
                    })}
                    className="w-full px-3 py-2 border rounded-md"
                    min="1000"
                    max="30000"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleRateSettingsSubmit} size="sm">
                  Apply Settings
                </Button>
                <Button onClick={() => setShowSettings(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {status.errors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.errors.slice(0, 3).map((error, index) => (
                <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              ))}
              {status.errors.length > 3 && (
                <p className="text-sm text-gray-600">
                  ... and {status.errors.length - 3} more errors
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GPS51AntiOverloadDashboard;
