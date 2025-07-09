import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Clock, Shield, Users, Database } from 'lucide-react';
import { GPS51PermissionValidator, PermissionValidationReport } from '@/services/gps51/GPS51PermissionValidator';
import { GPS51AuthCredentials } from '@/services/gps51/GPS51Types';
import { useToast } from '@/hooks/use-toast';

interface GPS51PermissionDiagnosticsPanelProps {
  credentials: GPS51AuthCredentials | null;
}

export const GPS51PermissionDiagnosticsPanel: React.FC<GPS51PermissionDiagnosticsPanelProps> = ({
  credentials
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<PermissionValidationReport | null>(null);
  const { toast } = useToast();
  const validator = GPS51PermissionValidator.getInstance();

  const runDiagnostics = async () => {
    if (!credentials || !credentials.username || !credentials.password || !credentials.apiUrl) {
      toast({
        title: "Missing Credentials",
        description: "Please configure GPS51 credentials before running diagnostics.",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    try {
      const validationReport = await validator.validatePermissions(credentials);
      setReport(validationReport);
      
      if (validationReport.criticalIssues.length > 0) {
        toast({
          title: "Permission Issues Detected",
          description: `Found ${validationReport.criticalIssues.length} critical issues that need attention.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Diagnostics Complete",
          description: "Permission validation completed successfully.",
        });
      }
    } catch (error) {
      console.error('Permission diagnostics error:', error);
      toast({
        title: "Diagnostics Failed",
        description: "Failed to run permission diagnostics. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'allowed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'denied':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'success' || status === 'allowed' ? 'default' :
                   status === 'failed' || status === 'denied' ? 'destructive' :
                   status === 'partial' ? 'secondary' : 'outline';
    
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          GPS51 Permission Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Run comprehensive permission validation to identify access rights and potential issues.
          </p>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Run Diagnostics
              </>
            )}
          </Button>
        </div>

        {report && (
          <div className="space-y-4">
            {/* Summary Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Validation Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Authentication:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.authenticationStatus)}
                      {getStatusBadge(report.authenticationStatus)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Device List Access:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.deviceListAccess)}
                      {getStatusBadge(report.deviceListAccess)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Position Data Access:</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.positionDataAccess)}
                      {getStatusBadge(report.positionDataAccess)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Authorized Devices:</span>
                    <Badge variant="outline">{report.authorizedDevices}</Badge>
                  </div>
                </div>
                
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{report.permissionSummary}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tested: {report.testedDevices} devices | Found: {report.totalDevicesFound} total
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Critical Issues */}
            {report.criticalIssues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    Critical Issues ({report.criticalIssues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.criticalIssues.map((issue, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Recommendations ({report.recommendations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Unauthorized Devices */}
            {report.unauthorizedDevices.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Unauthorized Devices ({report.unauthorizedDevices.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {report.unauthorizedDevices.slice(0, 10).map((deviceId) => (
                      <Badge key={deviceId} variant="outline" className="text-xs">
                        {deviceId}
                      </Badge>
                    ))}
                    {report.unauthorizedDevices.length > 10 && (
                      <Badge variant="secondary" className="text-xs">
                        +{report.unauthorizedDevices.length - 10} more
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground text-center">
              Report generated: {new Date(report.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};