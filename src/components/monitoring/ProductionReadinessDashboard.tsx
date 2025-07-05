import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { gps51ProductionReadinessService, ProductionReadinessReport } from '@/services/production/GPS51ProductionReadinessService';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw,
  Shield,
  Database,
  Activity,
  Settings,
  Zap
} from 'lucide-react';

export function ProductionReadinessDashboard() {
  const [report, setReport] = useState<ProductionReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runReadinessCheck = async () => {
    setLoading(true);
    try {
      const newReport = await gps51ProductionReadinessService.runFullProductionReadinessCheck();
      setReport(newReport);
    } catch (error) {
      console.error('Production readiness check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runReadinessCheck();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'fail': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'authentication': return <Shield className="h-5 w-5" />;
      case 'database': return <Database className="h-5 w-5" />;
      case 'gps51': return <Activity className="h-5 w-5" />;
      case 'monitoring': return <Activity className="h-5 w-5" />;
      case 'performance': return <Zap className="h-5 w-5" />;
      case 'environment': return <Settings className="h-5 w-5" />;
      case 'security': return <Shield className="h-5 w-5" />;
      case 'production': return <Settings className="h-5 w-5" />;
      default: return <Settings className="h-5 w-5" />;
    }
  };

  if (!report && loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" />
            <p>Running production readiness check...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="text-center p-8">
          <p>Failed to load production readiness report</p>
          <Button onClick={runReadinessCheck} className="mt-4">
            Retry Check
          </Button>
        </CardContent>
      </Card>
    );
  }

  const categories = [...new Set(report.checks.map(c => c.category))];

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Production Readiness Status
                <Badge variant={
                  report.overall === 'ready' ? 'default' : 
                  report.overall === 'warning' ? 'secondary' : 'destructive'
                }>
                  {report.overall.toUpperCase()}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Environment: {report.environment.toUpperCase()} • 
                Last check: {new Date(report.timestamp).toLocaleString()}
              </p>
            </div>
            <Button 
              onClick={runReadinessCheck} 
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{report.score}%</div>
              <div className="text-sm text-muted-foreground">Overall Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{report.criticalIssues}</div>
              <div className="text-sm text-muted-foreground">Critical Issues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{report.warningIssues}</div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {report.totalChecks - report.criticalIssues - report.warningIssues}
              </div>
              <div className="text-sm text-muted-foreground">Passed</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Readiness Score</span>
              <span>{report.score}%</span>
            </div>
            <Progress value={report.score} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues Alert */}
      {report.criticalIssues > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{report.criticalIssues} Critical Issue{report.criticalIssues > 1 ? 's' : ''} Found</strong>
            <p className="mt-1">These issues must be resolved before production deployment.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Results by Category */}
      <div className="grid gap-6">
        {categories.map(category => {
          const categoryChecks = report.checks.filter(c => c.category === category);
          const criticalCount = categoryChecks.filter(c => c.status === 'fail' && c.critical).length;
          const warningCount = categoryChecks.filter(c => c.status === 'warning' || (c.status === 'fail' && !c.critical)).length;
          const passCount = categoryChecks.filter(c => c.status === 'pass').length;

          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getCategoryIcon(category)}
                  {category}
                  <div className="flex gap-2 ml-auto">
                    {criticalCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {criticalCount} Critical
                      </Badge>
                    )}
                    {warningCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {warningCount} Warning
                      </Badge>
                    )}
                    {passCount > 0 && (
                      <Badge variant="default" className="text-xs">
                        {passCount} Pass
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryChecks.map((check, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded border">
                      {getStatusIcon(check.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{check.name}</span>
                          {check.critical && (
                            <Badge variant="outline" className="text-xs">
                              CRITICAL
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${getStatusColor(check.status)}`}>
                          {check.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Production Deployment Status */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Status</CardTitle>
        </CardHeader>
        <CardContent>
          {report.overall === 'ready' ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>✅ System Ready for Production Deployment</strong>
                <p className="mt-1">All critical checks passed. System is production-ready.</p>
              </AlertDescription>
            </Alert>
          ) : report.overall === 'warning' ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>⚠️ System Ready with Warnings</strong>
                <p className="mt-1">
                  System can be deployed but has {report.warningIssues} warning{report.warningIssues > 1 ? 's' : ''} 
                  that should be addressed.
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>❌ System Not Ready for Production</strong>
                <p className="mt-1">
                  {report.criticalIssues} critical issue{report.criticalIssues > 1 ? 's' : ''} 
                  must be resolved before deployment.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}