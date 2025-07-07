import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  Play, 
  RefreshCw, 
  Shield
} from 'lucide-react';
import { ValidationStep } from './ValidationStep';
import { useGPS51ValidationActions } from '@/hooks/useGPS51ValidationActions';

export const GPS51ProductionValidator = () => {
  const {
    isValidating,
    validationSteps,
    runProductionValidation,
    resetValidation,
    handleQuickFix
  } = useGPS51ValidationActions();

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
            <ValidationStep
              key={index}
              step={step}
              onQuickFix={handleQuickFix}
            />
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