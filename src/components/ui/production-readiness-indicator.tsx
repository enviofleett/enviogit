import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Settings } from 'lucide-react';
import { gps51ProductionBootstrap, ProductionBootstrapResult } from '@/services/production/GPS51ProductionBootstrap';
import { useToast } from '@/hooks/use-toast';

interface ProductionReadinessIndicatorProps {
  onConfigureClick?: () => void;
  showFullDetails?: boolean;
}

export function ProductionReadinessIndicator({ 
  onConfigureClick, 
  showFullDetails = false 
}: ProductionReadinessIndicatorProps) {
  const [status, setStatus] = useState<ProductionBootstrapResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    setIsLoading(true);
    try {
      const result = await gps51ProductionBootstrap.initializeProductionSystem();
      setStatus(result);
    } catch (error) {
      console.error('Failed to check system status:', error);
      setStatus({
        success: false,
        authenticated: false,
        systemReady: false,
        errors: ['Failed to check system status'],
        warnings: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await checkSystemStatus();
    toast({
      title: "System Status Refreshed",
      description: "Production readiness check completed"
    });
  };

  const getStatusIcon = () => {
    if (isLoading) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (!status) return <XCircle className="h-4 w-4 text-destructive" />;
    
    if (status.systemReady) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status.authenticated) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getStatusText = () => {
    if (isLoading) return "Checking...";
    if (!status) return "Unknown";
    
    if (status.systemReady) return "Production Ready";
    if (status.authenticated) return "Authenticated";
    if (status.errors.length > 0) return "Configuration Required";
    return "Not Ready";
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" => {
    if (!status || status.errors.length > 0) return "destructive";
    if (status.systemReady) return "default";
    return "secondary";
  };

  if (!showFullDetails) {
    // Compact indicator
    return (
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <Badge variant={getStatusVariant()} className="text-xs">
          {getStatusText()}
        </Badge>
      </div>
    );
  }

  // Full details view
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <h3 className="font-semibold">Production System Status</h3>
            <Badge variant={getStatusVariant()}>
              {getStatusText()}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {onConfigureClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onConfigureClick}
              >
                <Settings className="h-3 w-3 mr-1" />
                Configure
              </Button>
            )}
          </div>
        </div>

        {status && (
          <div className="space-y-3">
            {/* System Status Summary */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className={`font-medium ${status.authenticated ? 'text-green-600' : 'text-destructive'}`}>
                  {status.authenticated ? 'Connected' : 'Disconnected'}
                </div>
                <div className="text-muted-foreground">GPS51 Auth</div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${status.success ? 'text-green-600' : 'text-destructive'}`}>
                  {status.success ? 'Healthy' : 'Issues'}
                </div>
                <div className="text-muted-foreground">System Health</div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${status.systemReady ? 'text-green-600' : 'text-yellow-600'}`}>
                  {status.systemReady ? 'Ready' : 'Pending'}
                </div>
                <div className="text-muted-foreground">Production</div>
              </div>
            </div>

            {/* Errors */}
            {status.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Configuration Issues:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {status.errors.map((error, index) => (
                      <li key={index} className="text-sm">{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {status.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">Warnings:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {status.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {status.systemReady && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium text-green-700">
                    🚀 System is production ready and fully operational
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}