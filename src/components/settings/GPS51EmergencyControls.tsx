import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Power, Shield, Clock, Activity } from 'lucide-react';

interface EmergencyStatus {
  active: boolean;
  reason?: string;
  activatedAt?: string;
  cooldownUntil?: string;
}

export const GPS51EmergencyControls = () => {
  const { toast } = useToast();
  const [emergencyStatus, setEmergencyStatus] = useState<EmergencyStatus>({ active: false });
  const [isLoading, setIsLoading] = useState(false);
  const [coordinatorStats, setCoordinatorStats] = useState({
    queueSize: 0,
    lastRequest: null as string | null,
    circuitBreakerOpen: false,
    cacheHitRate: 0
  });

  useEffect(() => {
    loadEmergencyStatus();
    loadCoordinatorStats();
    
    // Set up real-time monitoring
    const interval = setInterval(() => {
      loadEmergencyStatus();
      loadCoordinatorStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadEmergencyStatus = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'gps51_emergency_stop')
        .single();

      if (data?.value) {
        const status = JSON.parse(data.value);
        setEmergencyStatus(status);
      }
    } catch (error) {
      console.warn('Could not load emergency status:', error);
    }
  };

  const loadCoordinatorStats = async () => {
    try {
      // Get recent coordinator activity
      const { data: recentActivity } = await supabase
        .from('api_calls_monitor')
        .select('*')
        .eq('endpoint', 'GPS51-Coordinator')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (recentActivity) {
        const stats = {
          queueSize: 0, // Would need real-time queue size from coordinator
          lastRequest: recentActivity[0]?.timestamp || null,
          circuitBreakerOpen: recentActivity.some(a => 
            a.request_payload?.type === '8902_emergency_activated' && 
            new Date(a.request_payload?.cooldownUntil || 0) > new Date()
          ),
          cacheHitRate: 0 // Would calculate from cache hits vs misses
        };
        
        setCoordinatorStats(stats);
      }
    } catch (error) {
      console.warn('Could not load coordinator stats:', error);
    }
  };

  const toggleEmergencyStop = async () => {
    setIsLoading(true);
    try {
      const newStatus: EmergencyStatus = {
        active: !emergencyStatus.active,
        reason: emergencyStatus.active ? undefined : 'manual_admin_activation',
        activatedAt: emergencyStatus.active ? undefined : new Date().toISOString(),
        cooldownUntil: emergencyStatus.active ? undefined : new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };

      const { error } = await supabase.from('system_settings').upsert({
        key: 'gps51_emergency_stop',
        value: JSON.stringify(newStatus)
      });

      if (error) throw error;

      setEmergencyStatus(newStatus);
      
      toast({
        title: newStatus.active ? 'Emergency Stop Activated' : 'Emergency Stop Deactivated',
        description: newStatus.active 
          ? 'All GPS51 API requests have been suspended'
          : 'GPS51 API requests have been resumed',
        variant: newStatus.active ? 'destructive' : 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle emergency stop',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetCircuitBreaker = async () => {
    setIsLoading(true);
    try {
      // Reset circuit breaker by clearing emergency stop
      const { error } = await supabase.from('system_settings').upsert({
        key: 'gps51_emergency_stop',
        value: JSON.stringify({ active: false })
      });

      if (error) throw error;

      // Also try to reset the rate limiter state
      const { error: resetError } = await supabase.functions.invoke('gps51-rate-limiter', {
        body: { action: 'reset_state' }
      });

      if (resetError) {
        console.warn('Could not reset rate limiter:', resetError);
      }

      await loadEmergencyStatus();
      await loadCoordinatorStats();

      toast({
        title: 'Circuit Breaker Reset',
        description: 'GPS51 circuit breaker has been reset and system is ready to resume',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset circuit breaker',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeRemaining = (cooldownUntil: string) => {
    const remaining = new Date(cooldownUntil).getTime() - Date.now();
    if (remaining <= 0) return 'Expired';
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            GPS51 Emergency Controls
          </CardTitle>
          <CardDescription>
            Emergency stop for all GPS51 API requests across the entire platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emergencyStatus.active && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Emergency stop is currently active. All GPS51 API requests are suspended.
                {emergencyStatus.cooldownUntil && (
                  <span className="block mt-1">
                    Cooldown expires in: {formatTimeRemaining(emergencyStatus.cooldownUntil)}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-base font-medium">Emergency Stop</div>
              <div className="text-sm text-muted-foreground">
                Immediately suspend all GPS51 API requests
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={emergencyStatus.active ? "destructive" : "default"}>
                {emergencyStatus.active ? "ACTIVE" : "INACTIVE"}
              </Badge>
              <Switch
                checked={emergencyStatus.active}
                onCheckedChange={toggleEmergencyStop}
                disabled={isLoading}
              />
            </div>
          </div>

          {coordinatorStats.circuitBreakerOpen && (
            <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Circuit Breaker Open</span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={resetCircuitBreaker}
                disabled={isLoading}
              >
                Reset Circuit Breaker
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            GPS51 Coordinator Status
          </CardTitle>
          <CardDescription>
            Real-time status of the GPS51 request coordinator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Last Request</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {coordinatorStats.lastRequest 
                  ? new Date(coordinatorStats.lastRequest).toLocaleString()
                  : 'No recent requests'
                }
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Circuit Breaker</span>
              </div>
              <Badge variant={coordinatorStats.circuitBreakerOpen ? "destructive" : "default"}>
                {coordinatorStats.circuitBreakerOpen ? "OPEN" : "CLOSED"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};