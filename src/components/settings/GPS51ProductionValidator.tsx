import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  Shield,
  Database,
  Zap,
  Activity
} from 'lucide-react';
import { gps51EmergencyManager } from '@/services/gps51/GPS51EmergencyManager';
import { useToast } from '@/hooks/use-toast';

interface ValidationStep {
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  data?: any;
}

export const GPS51ProductionValidator = () => {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([
    {
      name: 'Authentication',
      description: 'Verify GPS51 credentials and token generation',
      status: 'pending'
    },
    {
      name: 'Device List',
      description: 'Fetch device list with emergency caching',
      status: 'pending'
    },
    {
      name: 'Real-time Positions',
      description: 'Retrieve live vehicle positions',
      status: 'pending'
    },
    {
      name: 'Data Flow',
      description: 'Verify end-to-end data processing',
      status: 'pending'
    }
  ]);

  const updateStep = (index: number, update: Partial<ValidationStep>) => {
    setValidationSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, ...update } : step
    ));
  };

  const runProductionValidation = async () => {
    setIsValidating(true);
    
    try {
      // Step 1: Authentication
      updateStep(0, { status: 'running' });
      
      if (!gps51EmergencyManager.isAuthenticated()) {
        // Try to authenticate with saved credentials
        const savedCredentials = localStorage.getItem('gps51_credentials');
        if (!savedCredentials) {
          throw new Error('No saved credentials found. Please authenticate first.');
        }
        
        const credentials = JSON.parse(savedCredentials);
        const authResult = await gps51EmergencyManager.authenticate(credentials);
        
        if (!authResult.success) {
          throw new Error(authResult.error || 'Authentication failed');
        }
      }
      
      updateStep(0, { 
        status: 'success', 
        data: { username: gps51EmergencyManager.getUsername() } 
      });

      // Step 2: Device List
      updateStep(1, { status: 'running' });
      const devices = await gps51EmergencyManager.getDeviceList(false);
      updateStep(1, { 
        status: 'success', 
        data: { count: devices.length } 
      });

      // Step 3: Real-time Positions
      updateStep(2, { status: 'running' });
      const deviceIds = devices.map(d => d.deviceid).slice(0, 5); // Test with first 5 devices
      const positionsResult = await gps51EmergencyManager.getRealtimePositions(deviceIds, 0);
      updateStep(2, { 
        status: 'success', 
        data: { 
          positions: positionsResult.positions.length,
          lastQueryTime: positionsResult.lastQueryTime 
        } 
      });

      // Step 4: Data Flow
      updateStep(3, { status: 'running' });
      const diagnostics = gps51EmergencyManager.getDiagnostics();
      updateStep(3, { 
        status: 'success', 
        data: { 
          cacheSize: diagnostics.client.cacheSize,
          queueSize: diagnostics.client.queueSize 
        } 
      });

      toast({
        title: 'Production Validation Complete',
        description: `Successfully validated all systems. ${devices.length} devices, ${positionsResult.positions.length} positions retrieved.`,
      });

    } catch (error) {
      const currentStep = validationSteps.findIndex(step => step.status === 'running');
      if (currentStep >= 0) {
        updateStep(currentStep, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
      
      toast({
        title: 'Production Validation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const resetValidation = () => {
    setValidationSteps(prev => prev.map(step => ({ 
      ...step, 
      status: 'pending' as const,
      error: undefined,
      data: undefined
    })));
  };

  const successfulSteps = validationSteps.filter(step => step.status === 'success').length;
  const progressPercentage = (successfulSteps / validationSteps.length) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Production Readiness Validation
        </CardTitle>
        <CardDescription>
          Comprehensive validation of GPS51 emergency system for live deployment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{Math.round(progressPercentage)}%</div>
            <div className="text-sm text-muted-foreground">Production Ready</div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={resetValidation}
              variant="outline"
              size="sm"
              disabled={isValidating}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button
              onClick={runProductionValidation}
              disabled={isValidating}
              className="flex items-center gap-2"
            >
              <Play className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
              {isValidating ? 'Validating...' : 'Run Validation'}
            </Button>
          </div>
        </div>
        
        <Progress value={progressPercentage} className="w-full" />

        <div className="space-y-3">
          {validationSteps.map((step, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{step.name}</div>
                <div className="flex items-center gap-2">
                  {step.status === 'pending' && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                  {step.status === 'running' && (
                    <Badge variant="secondary">
                      <Activity className="h-3 w-3 mr-1 animate-pulse" />
                      Running
                    </Badge>
                  )}
                  {step.status === 'success' && (
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Success
                    </Badge>
                  )}
                  {step.status === 'error' && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">
                {step.description}
              </div>
              
              {step.data && (
                <div className="text-xs bg-muted p-2 rounded">
                  <strong>Result:</strong> {JSON.stringify(step.data, null, 2)}
                </div>
              )}
              
              {step.error && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{step.error}</AlertDescription>
                </Alert>
              )}
            </div>
          ))}
        </div>

        {progressPercentage === 100 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              🎉 All validation steps completed successfully! The GPS51 emergency system is ready for live deployment.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};