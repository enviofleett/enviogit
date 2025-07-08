import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, Download, Play } from 'lucide-react';
import { gps51AuthDiagnostics, type ComprehensiveDiagnostic } from '@/services/gps51/GPS51AuthDiagnostics';
import { gps51ProductionService } from '@/services/gps51/GPS51ProductionService';
import { useToast } from '@/hooks/use-toast';

export const GPS51AuthDiagnosticsPanel = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostic, setDiagnostic] = useState<ComprehensiveDiagnostic | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const runDiagnostics = async () => {
    try {
      setIsRunning(true);
      
      const authState = gps51ProductionService.getAuthState();
      const config = { username: authState.username, password: '', apiUrl: 'https://gps51.com/api/v2' };
      if (!config) {
        toast({
          title: "Configuration Required",
          description: "Please configure GPS51 credentials first",
          variant: "destructive"
        });
        return;
      }

      console.log('GPS51AuthDiagnosticsPanel: Starting comprehensive diagnostic...');
      
      const result = await gps51AuthDiagnostics.runComprehensiveDiagnostic(config);
      setDiagnostic(result);
      
      toast({
        title: "Diagnostic Complete",
        description: `Tested ${result.summary.totalConfigurations} configurations. Found ${result.summary.successfulConfigurations} working setups.`,
      });
      
    } catch (error) {
      console.error('GPS51AuthDiagnosticsPanel: Diagnostic failed:', error);
      toast({
        title: "Diagnostic Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const toggleResultExpansion = (index: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedResults(newExpanded);
  };

  const downloadReport = () => {
    if (!diagnostic) return;
    
    const report = gps51AuthDiagnostics.formatDiagnosticReport(diagnostic);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `gps51-auth-diagnostic-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Report Downloaded",
      description: "Diagnostic report saved to downloads folder"
    });
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge variant={success ? "default" : "destructive"}>
        {success ? "SUCCESS" : "FAILED"}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          GPS51 Authentication Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Run comprehensive authentication testing to diagnose connection issues
          </p>
          <div className="flex gap-2">
            <Button 
              onClick={runDiagnostics} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isRunning ? 'Running...' : 'Run Diagnostics'}
            </Button>
            {diagnostic && (
              <Button 
                variant="outline" 
                onClick={downloadReport}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Report
              </Button>
            )}
          </div>
        </div>

        {diagnostic && (
          <div className="space-y-4">
            {/* Summary */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold">Diagnostic Summary</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Username:</span> {diagnostic.credentials.username}
                    </div>
                    <div>
                      <span className="font-medium">Password Format:</span> {diagnostic.credentials.passwordFormat}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">API URL:</span> {diagnostic.credentials.apiUrl}
                    </div>
                    <div>
                      <span className="font-medium">Successful Configs:</span>{' '}
                      <span className={diagnostic.summary.successfulConfigurations > 0 ? 'text-green-600' : 'text-red-600'}>
                        {diagnostic.summary.successfulConfigurations} / {diagnostic.summary.totalConfigurations}
                      </span>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {/* Recommended Configuration */}
            {diagnostic.summary.recommendedConfig && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-semibold text-green-700">Recommended Configuration Found</div>
                    <div className="text-sm space-y-1">
                      <div><span className="font-medium">Endpoint:</span> {diagnostic.summary.recommendedConfig.endpoint}</div>
                      <div><span className="font-medium">Method:</span> {diagnostic.summary.recommendedConfig.method}</div>
                      <div><span className="font-medium">Parameters:</span> {JSON.stringify(diagnostic.summary.recommendedConfig.parameters)}</div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Test Results */}
            <div className="space-y-2">
              <h4 className="font-semibold">Detailed Test Results</h4>
              {diagnostic.results.map((result, index) => (
                <Collapsible key={index}>
                  <CollapsibleTrigger 
                    className="w-full"
                    onClick={() => toggleResultExpansion(index)}
                  >
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.success)}
                        <span className="text-sm font-medium">{result.test}</span>
                        {getStatusBadge(result.success)}
                      </div>
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${
                          expandedResults.has(index) ? 'rotate-180' : ''
                        }`} 
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-4 border-l-2 border-muted ml-6 space-y-3">
                      {result.error && (
                        <div className="text-sm">
                          <span className="font-medium text-red-600">Error:</span>
                          <div className="text-red-600 mt-1">{result.error}</div>
                        </div>
                      )}
                      
                      {result.details && (
                        <div className="text-sm">
                          <span className="font-medium">Details:</span>
                          <pre className="bg-muted/50 p-2 rounded mt-1 text-xs overflow-x-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {result.suggestions && result.suggestions.length > 0 && (
                        <div className="text-sm">
                          <span className="font-medium text-blue-600">Suggestions:</span>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {result.suggestions.map((suggestion, suggestionIndex) => (
                              <li key={suggestionIndex} className="text-blue-600">
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}

        {isRunning && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">
              Running comprehensive authentication tests...
            </p>
          </div>
        )}

        {!diagnostic && !isRunning && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This tool will test multiple GPS51 API endpoints and parameter combinations 
              to identify working authentication configurations. It helps diagnose issues 
              with empty responses, incorrect endpoints, and parameter format problems.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};