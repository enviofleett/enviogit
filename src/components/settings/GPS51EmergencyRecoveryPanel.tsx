import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  MapPin, 
  RefreshCw, 
  Shield,
  TrendingUp,
  Zap 
} from 'lucide-react';
import { gps51DataRecoveryService, RecoveryReport, DeviceRecoveryResult } from '@/services/gps51/GPS51DataRecoveryService';
import { useToast } from '@/hooks/use-toast';

export const GPS51EmergencyRecoveryPanel = () => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryReport, setRecoveryReport] = useState<RecoveryReport | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const startEmergencyRecovery = async () => {
    setIsRecovering(true);
    setProgress(0);
    setRecoveryReport(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 15, 90));
      }, 1000);

      const report = await gps51DataRecoveryService.emergencyDataRecovery();
      
      clearInterval(progressInterval);
      setProgress(100);
      setRecoveryReport(report);

      toast({
        title: "Emergency Recovery Completed",
        description: `Successfully processed ${report.totalDevicesProcessed} devices, fixed ${report.successfullyFixed} positions`,
      });

    } catch (error) {
      console.error('Emergency recovery failed:', error);
      toast({
        title: "Emergency Recovery Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsRecovering(false);
      setProgress(0);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSuccessRate = () => {
    if (!recoveryReport) return 0;
    return recoveryReport.totalDevicesProcessed > 0 
      ? Math.round((recoveryReport.successfullyFixed / recoveryReport.totalDevicesProcessed) * 100)
      : 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            <CardTitle>Emergency GPS Data Recovery</CardTitle>
          </div>
          <CardDescription>
            Emergency recovery system for GPS position data pipeline issues. 
            This tool diagnoses and fixes data quality problems automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button 
              onClick={startEmergencyRecovery}
              disabled={isRecovering}
              className="min-w-48"
            >
              {isRecovering ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running Recovery...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Start Emergency Recovery
                </>
              )}
            </Button>
            
            {isRecovering && (
              <div className="flex-1 max-w-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-sm font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recovery Results */}
      {recoveryReport && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{recoveryReport.totalDevicesProcessed}</p>
                    <p className="text-sm text-muted-foreground">Devices Processed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">{recoveryReport.successfullyFixed}</p>
                    <p className="text-sm text-muted-foreground">Successfully Fixed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{getSuccessRate()}%</p>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-2xl font-bold">{Math.round(recoveryReport.executionTimeMs / 1000)}s</p>
                    <p className="text-sm text-muted-foreground">Execution Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recovery Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Recovery Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Positions Recovered</p>
                  <p className="text-2xl font-bold text-green-600">
                    {recoveryReport.summary.positionsRecovered}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Data Quality Improved</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {recoveryReport.summary.dataQualityImproved}%
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Emergency Status</p>
                  <Badge variant={recoveryReport.summary.emergencyRecoveryNeeded ? "destructive" : "secondary"}>
                    {recoveryReport.summary.emergencyRecoveryNeeded ? "Action Required" : "Stable"}
                  </Badge>
                </div>
              </div>

              {recoveryReport.summary.emergencyRecoveryNeeded && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    High failure rate detected ({recoveryReport.failedDevices}/{recoveryReport.totalDevicesProcessed} devices failed). 
                    Consider investigating GPS51 API connectivity or device configurations.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Device Results */}
          {recoveryReport.deviceResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Device Recovery Details</CardTitle>
                <CardDescription>
                  Detailed results for individual device recovery operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recoveryReport.deviceResults.slice(0, 10).map((result, index) => (
                    <div key={result.deviceId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={result.success ? "secondary" : "destructive"}>
                            {result.success ? "Success" : "Failed"}
                          </Badge>
                          <span className="font-mono text-sm">{result.deviceId}</span>
                        </div>
                        {result.fixesApplied.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {result.fixesApplied.length} fixes applied
                          </span>
                        )}
                      </div>

                      {result.issues.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Issues Found:</p>
                          <div className="flex flex-wrap gap-2">
                            {result.issues.map((issue, issueIndex) => (
                              <Badge 
                                key={issueIndex}
                                variant={getSeverityColor(issue.severity)}
                                className="text-xs"
                              >
                                {issue.description}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.fixesApplied.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-green-600">
                            Fixes Applied: {result.fixesApplied.join(', ')}
                          </p>
                        </div>
                      )}

                      {result.error && (
                        <div className="mt-2">
                          <p className="text-sm text-red-600">Error: {result.error}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {recoveryReport.deviceResults.length > 10 && (
                    <div className="text-center py-2">
                      <p className="text-sm text-muted-foreground">
                        Showing 10 of {recoveryReport.deviceResults.length} results
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Emergency Recovery Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
            <div>
              <p className="font-medium">Device Discovery</p>
              <p className="text-sm text-muted-foreground">Retrieves all GPS51 devices and checks authentication</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
            <div>
              <p className="font-medium">Data Quality Analysis</p>
              <p className="text-sm text-muted-foreground">Identifies missing coordinates, invalid ranges, and stale data</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
            <div>
              <p className="font-medium">Automated Fixes</p>
              <p className="text-sm text-muted-foreground">Applies coordinate validation, range clamping, and default values</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</div>
            <div>
              <p className="font-medium">Database Integration</p>
              <p className="text-sm text-muted-foreground">Saves recovered data using enhanced UPSERT functions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};