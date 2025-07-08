/**
 * GPS51 Production Ready Panel
 * Shows production readiness status and enables live mode
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Rocket, 
  Shield,
  Database,
  Wifi,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { gps51ProductionAuthManager } from '@/services/gps51/GPS51ProductionAuthManager';
import { gps51RealTimeActivationService } from '@/services/gps51/GPS51RealTimeActivationService';

interface ProductionCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  critical: boolean;
}

export const GPS51ProductionReadyPanel = () => {
  const [checks, setChecks] = useState<ProductionCheck[]>([]);
  const [isActivating, setIsActivating] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [activationStats, setActivationStats] = useState<any>(null);
  const { toast } = useToast();

  const runProductionChecks = async () => {
    const newChecks: ProductionCheck[] = [];

    try {
      // 1. Authentication Check
      const authStatus = gps51ProductionAuthManager.getAuthenticationStatus();
      newChecks.push({
        id: 'auth',
        name: 'GPS51 Authentication',
        status: authStatus.isAuthenticated ? 'pass' : 'fail',
        message: authStatus.isAuthenticated 
          ? `Authenticated as ${authStatus.username}` 
          : authStatus.error || 'Not authenticated',
        critical: true
      });

      // 2. Configuration Check  
      newChecks.push({
        id: 'config',
        name: 'GPS51 Configuration',
        status: authStatus.isConfigured ? 'pass' : 'fail',
        message: authStatus.isConfigured 
          ? 'GPS51 credentials properly configured' 
          : 'GPS51 credentials not configured',
        critical: true
      });

      // 3. Vehicle Data Check
      newChecks.push({
        id: 'vehicles',
        name: 'Vehicle Data',
        status: authStatus.deviceCount > 0 ? 'pass' : 'warning',
        message: `${authStatus.deviceCount} vehicles found`,
        critical: false
      });

      // 4. Fleet Activity Check
      newChecks.push({
        id: 'activity',
        name: 'Fleet Activity',
        status: authStatus.movingVehicles > 0 ? 'pass' : 'warning',
        message: `${authStatus.movingVehicles} vehicles currently moving`,
        critical: false
      });

      // 5. Production Readiness Check
      const isReady = gps51ProductionAuthManager.isProductionReady();
      newChecks.push({
        id: 'production',
        name: 'Production Ready',
        status: isReady ? 'pass' : 'fail',
        message: isReady 
          ? 'System is production ready' 
          : 'System not ready for production use',
        critical: true
      });

      setChecks(newChecks);
    } catch (error) {
      console.error('Production checks failed:', error);
      toast({
        title: "Production Check Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  };

  const activateRealTimeSystem = async () => {
    setIsActivating(true);
    try {
      console.log('GPS51ProductionReadyPanel: Activating real-time system...');
      
      const result = await gps51RealTimeActivationService.activateRealTimeSystem();
      
      if (result.success) {
        setIsActive(true);
        setActivationStats(result.stats);
        toast({
          title: "Real-Time System Activated",
          description: result.message,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Real-time activation failed:', error);
      toast({
        title: "Activation Failed",
        description: error instanceof Error ? error.message : 'Failed to activate real-time system',
        variant: "destructive"
      });
    } finally {
      setIsActivating(false);
    }
  };

  const deactivateRealTimeSystem = async () => {
    try {
      const result = await gps51RealTimeActivationService.deactivateRealTimeSystem();
      
      if (result.success) {
        setIsActive(false);
        setActivationStats(null);
        toast({
          title: "Real-Time System Deactivated",
          description: result.message,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Real-time deactivation failed:', error);
      toast({
        title: "Deactivation Failed",
        description: error instanceof Error ? error.message : 'Failed to deactivate real-time system',
        variant: "destructive"
      });
    }
  };

  // Run checks on mount
  useEffect(() => {
    runProductionChecks();
    
    // Check if real-time system is already active
    const status = gps51RealTimeActivationService.getActivationStatus();
    setIsActive(status.isActive);
    if (status.isActive) {
      setActivationStats(status.stats);
    }
  }, []);

  const criticalFailures = checks.filter(c => c.critical && c.status === 'fail').length;
  const allCriticalPass = checks.filter(c => c.critical).every(c => c.status === 'pass');
  const overallScore = Math.round((checks.filter(c => c.status === 'pass').length / checks.length) * 100);

  const getStatusIcon = (status: ProductionCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          GPS51 Production Control Center
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Production Readiness Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Production Readiness Score</h4>
            <Badge variant={overallScore >= 80 ? "default" : "destructive"}>
              {overallScore}%
            </Badge>
          </div>
          <Progress value={overallScore} className="h-2" />
        </div>

        {/* Production Checks */}
        <div className="space-y-3">
          <h4 className="font-medium">System Checks</h4>
          <div className="space-y-2">
            {checks.map((check) => (
              <div 
                key={check.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  check.status === 'pass' ? 'bg-green-50 border-green-200' :
                  check.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(check.status)}
                  <div>
                    <div className="font-medium text-sm">
                      {check.name}
                      {check.critical && <span className="text-red-500 ml-1">*</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{check.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-Time System Status */}
        {activationStats && (
          <div className="space-y-3">
            <h4 className="font-medium">Real-Time System Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground">Total Vehicles</span>
                <p className="font-medium">{activationStats.totalVehicles}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Polling Interval</span>
                <p className="font-medium">{activationStats.pollingInterval / 1000}s</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Priority 1 Vehicles</span>
                <p className="font-medium">{activationStats.priority1Vehicles}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Last Activation</span>
                <p className="font-medium">
                  {activationStats.lastActivation ? 
                    new Date(activationStats.lastActivation).toLocaleTimeString() : 
                    'Never'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Critical Failures Alert */}
        {criticalFailures > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{criticalFailures} Critical Issues:</strong> System is not ready for production. 
              Please resolve critical issues before activating real-time monitoring.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={runProductionChecks}
            variant="outline"
            className="flex-1"
          >
            <Shield className="h-4 w-4 mr-2" />
            Refresh Checks
          </Button>
          
          {!isActive ? (
            <Button
              onClick={activateRealTimeSystem}
              disabled={!allCriticalPass || isActivating}
              className="flex-1"
            >
              {isActivating ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Go Live
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={deactivateRealTimeSystem}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Stop Live Mode
            </Button>
          )}
        </div>

        {/* Production Notes */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <p>* Critical checks must pass before activating production mode</p>
          <p>Real-time mode enables 30-second vehicle polling and live dashboard updates</p>
        </div>
      </CardContent>
    </Card>
  );
};