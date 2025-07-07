/**
 * EMERGENCY DASHBOARD COMPONENT
 * Ultra-conservative API usage with comprehensive monitoring
 */

import React, { useState, useCallback } from 'react';
import { useEmergencyGPS51 } from '@/hooks/useEmergencyGPS51';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Activity, RefreshCw, Trash2, Power } from 'lucide-react';

interface EmergencyGPS51DashboardProps {
  apiUrl: string;
}

export function EmergencyGPS51Dashboard({ apiUrl }: EmergencyGPS51DashboardProps) {
  const {
    isAuthenticated,
    loading,
    error,
    devices,
    positions,
    diagnostics,
    login,
    logout,
    updatePositions,
    clearCaches
  } = useEmergencyGPS51({
    baseUrl: apiUrl,
    emergencyRefreshInterval: 120000, // 2 minutes
    maxDevicesPerBatch: 50
  });

  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await login(credentials.username, credentials.password);
  }, [login, credentials]);

  const handleEmergencyStop = useCallback(() => {
    clearCaches();
    logout();
  }, [clearCaches, logout]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto border-destructive">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              🚨 EMERGENCY MODE
            </CardTitle>
            <CardDescription className="text-destructive">
              API Spike Prevention Active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="border-destructive/50 focus:border-destructive"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="border-destructive/50 focus:border-destructive"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-destructive hover:bg-destructive/90"
              >
                {loading ? 'Emergency Login...' : 'Emergency Login'}
              </Button>
            </form>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Emergency Header */}
      <Card className="border-destructive bg-destructive/5">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                🚨 EMERGENCY GPS DASHBOARD
              </CardTitle>
              <CardDescription className="text-destructive">
                API Spike Prevention: ACTIVE
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => updatePositions(true)}
                disabled={loading}
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {loading ? 'Updating...' : 'Force Update'}
              </Button>
              <Button
                onClick={clearCaches}
                variant="outline"
                size="sm"
                className="border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Cache
              </Button>
              <Button
                onClick={handleEmergencyStop}
                variant="destructive"
                size="sm"
              >
                <Power className="h-4 w-4 mr-2" />
                Emergency Stop
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Diagnostics Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            🔧 Emergency Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{diagnostics.queueSize || 0}</div>
              <div className="text-sm text-muted-foreground">Queue Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{diagnostics.cacheSize || 0}</div>
              <div className="text-sm text-muted-foreground">Cache Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{devices.length}</div>
              <div className="text-sm text-muted-foreground">Devices</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{positions.length}</div>
              <div className="text-sm text-muted-foreground">Positions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Emergency Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {positions.map((position, index) => (
          <Card key={position.deviceid || index} className="border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{position.deviceid}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Lat:</span> {position.callat?.toFixed(6)}</p>
                <p><span className="font-medium">Lon:</span> {position.callon?.toFixed(6)}</p>
                <p><span className="font-medium">Speed:</span> {position.speed} km/h</p>
                <p><span className="font-medium">Updated:</span> {new Date(position.updatetime).toLocaleString()}</p>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  <Badge variant={position.moving ? "default" : "secondary"}>
                    {position.moving ? 'Moving' : 'Stopped'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {positions.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            No position data available
          </CardContent>
        </Card>
      )}

      {/* Emergency Instructions */}
      <Card className="border-yellow-500 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-800">
            ⚠️ Emergency Mode Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-yellow-700 space-y-1 text-sm">
            <li>• All API calls are rate-limited to 2-second intervals</li>
            <li>• Position updates happen every 2 minutes maximum</li>
            <li>• All device positions are fetched in ONE batch request</li>
            <li>• Aggressive caching prevents duplicate requests</li>
            <li>• Monitor the queue size - should stay near 0</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}