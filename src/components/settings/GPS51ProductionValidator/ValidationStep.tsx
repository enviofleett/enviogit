import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Activity, Database, TestTube } from 'lucide-react';
import { ValidationStep as ValidationStepType } from './types';
import { QuickFixPanel } from './QuickFixPanel';

interface ValidationStepProps {
  step: ValidationStepType;
  onQuickFix: (action: string) => void;
}

export const ValidationStep: React.FC<ValidationStepProps> = ({ step, onQuickFix }) => {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'running':
        return <Activity className="h-3 w-3 mr-1 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'error':
        return <AlertTriangle className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  const getStatusBadge = () => {
    switch (step.status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'running':
        return (
          <Badge variant="secondary">
            {getStatusIcon()}
            Running
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="default">
            {getStatusIcon()}
            Success
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            {getStatusIcon()}
            Error
          </Badge>
        );
    }
  };

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{step.name}</div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
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
      
      {step.error && step.errorDetails && (
        <div className="mt-3 space-y-3">
          {/* Error Summary */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium">{step.error}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {step.errorDetails.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {step.errorDetails.impact}
                  </span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Root Cause Analysis */}
          <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-destructive">
            <h5 className="font-medium text-sm mb-1 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Root Cause Analysis
            </h5>
            <p className="text-sm text-muted-foreground">{step.errorDetails.rootCause}</p>
          </div>

          {/* Quick Fixes */}
          <QuickFixPanel 
            quickFixes={step.errorDetails.quickFixes} 
            onQuickFix={onQuickFix} 
          />

          {/* Recommendations */}
          <div className="space-y-2">
            <h5 className="font-medium text-sm flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Recommended Actions
            </h5>
            <ul className="space-y-1">
              {step.errorDetails.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Technical Details (Collapsible) */}
          {step.errorDetails.technicalDetails && (
            <details className="border rounded-lg p-2">
              <summary className="text-xs font-medium cursor-pointer text-muted-foreground">
                Technical Details (Click to expand)
              </summary>
              <div className="mt-2 text-xs bg-muted p-2 rounded font-mono">
                <pre>{JSON.stringify(step.errorDetails.technicalDetails, null, 2)}</pre>
              </div>
            </details>
          )}
        </div>
      )}

      {step.error && !step.errorDetails && (
        <Alert variant="destructive" className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{step.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};