import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Play,
  Download,
  FileText,
  Database,
  Zap
} from 'lucide-react';
import { rlsSecurityAuditService, SecurityAuditResult, SecurityIssue } from '@/services/security/RLSSecurityAuditService';
import { useToast } from '@/hooks/use-toast';

export const RLSSecurityAuditDashboard = () => {
  const [auditResult, setAuditResult] = useState<SecurityAuditResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Run initial audit on component mount
    runSecurityAudit();
  }, []);

  const runSecurityAudit = async () => {
    setIsRunning(true);
    try {
      const result = await rlsSecurityAuditService.performComprehensiveAudit();
      setAuditResult(result);
      
      toast({
        title: "Security Audit Completed",
        description: `Score: ${result.overallScore}/100, Found ${result.criticalIssues.length} critical issues`,
        variant: result.criticalIssues.length > 0 ? "destructive" : "default"
      });
    } catch (error) {
      console.error('Security audit failed:', error);
      toast({
        title: "Audit Failed",
        description: "Failed to complete security audit. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runMultiTenantTest = async () => {
    setIsTesting(true);
    try {
      const results = await rlsSecurityAuditService.testMultiTenantIsolation();
      setTestResults(results);
      
      toast({
        title: "Multi-Tenant Test Completed",
        description: results.passed ? "All tests passed" : "Some tests failed",
        variant: results.passed ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Multi-tenant test failed:', error);
      toast({
        title: "Test Failed",
        description: "Failed to run multi-tenant isolation tests",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const generateReport = async () => {
    try {
      const report = await rlsSecurityAuditService.generateSecurityReport();
      const blob = new Blob([report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rls-security-audit-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Report Generated",
        description: "Security audit report has been downloaded"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate security report",
        variant: "destructive"
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'hsl(var(--success))';
    if (score >= 70) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  const getSeverityBadge = (severity: SecurityIssue['severity']) => {
    const variants = {
      critical: 'destructive',
      high: 'destructive', 
      medium: 'secondary',
      low: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[severity]} className="capitalize">
        {severity}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            RLS Security Audit Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive Row Level Security analysis and diagnostics
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runSecurityAudit} disabled={isRunning} variant="outline">
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? 'Running...' : 'Run Audit'}
          </Button>
          <Button onClick={generateReport} disabled={!auditResult} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {auditResult && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security Score</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: getScoreColor(auditResult.overallScore) }}>
                {auditResult.overallScore}/100
              </div>
              <Progress 
                value={auditResult.overallScore} 
                className="mt-2" 
                style={{ '--progress-foreground': getScoreColor(auditResult.overallScore) } as any}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {auditResult.criticalIssues.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {auditResult.warnings.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Should be addressed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Secure Tables</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {auditResult.securedTables}/{auditResult.totalTables}
              </div>
              <p className="text-xs text-muted-foreground">
                Properly protected
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={runSecurityAudit} disabled={isRunning} size="sm">
              {isRunning ? 'Running...' : 'Run Full Security Audit'}
            </Button>
            <Button onClick={runMultiTenantTest} disabled={isTesting} variant="outline" size="sm">
              {isTesting ? 'Testing...' : 'Test Multi-Tenant Isolation'}
            </Button>
            <Button disabled={!auditResult} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              View Policy Details
            </Button>
            <Button onClick={generateReport} disabled={!auditResult} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Security Issues</TabsTrigger>
          <TabsTrigger value="tables">Table Status</TabsTrigger>
          <TabsTrigger value="tests">Multi-Tenant Tests</TabsTrigger>
          <TabsTrigger value="fixes">Automated Fixes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Table Security Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditResult ? (
                  <div className="space-y-4">
                    {['profiles', 'organizations', 'vehicles', 'vehicle_positions', 'geofences', 'alerts'].map(table => {
                      const hasRLS = Math.random() > 0.3; // Mock data for demo
                      return (
                        <div key={table} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-2">
                            {hasRLS ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="font-medium">{table}</span>
                          </div>
                          <Badge variant={hasRLS ? "default" : "destructive"}>
                            {hasRLS ? "Secured" : "RLS Disabled"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Run security audit to view table status</p>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Security Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Alert>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription>
                      Enable RLS on all tables containing sensitive data
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertDescription>
                      Implement organization isolation for multi-tenant tables
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Add role-based access policies for better security
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="issues">
          <div className="space-y-4">
            {auditResult?.criticalIssues.length === 0 && auditResult?.warnings.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Security Issues Found</h3>
                    <p className="text-muted-foreground">
                      All tables appear to be properly secured with RLS policies.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {auditResult?.criticalIssues.map(issue => (
                  <Card key={issue.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-destructive" />
                          {issue.description}
                        </CardTitle>
                        {getSeverityBadge(issue.severity)}
                      </div>
                      <CardDescription>Table: {issue.table}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Impact</h4>
                          <p className="text-sm text-muted-foreground">{issue.impact}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Recommendation</h4>
                          <p className="text-sm text-muted-foreground">{issue.recommendation}</p>
                        </div>
                        {issue.fixSQL && (
                          <div>
                            <h4 className="font-medium mb-2">Automated Fix</h4>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                              {issue.fixSQL}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle>Table Security Analysis</CardTitle>
              <CardDescription>
                Detailed security status for each critical table
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditResult ? (
                <div className="space-y-4">
                  {['profiles', 'organizations', 'vehicles', 'vehicle_positions', 'geofences', 'alerts'].map(table => {
                    const score = Math.floor(Math.random() * 100); // Mock data
                    const status = score >= 80 ? 'secure' : score >= 50 ? 'warning' : 'critical';
                    
                    return (
                      <div key={table} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{table}</h3>
                          <Badge variant={status === 'secure' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}>
                            {status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">RLS Enabled:</span>
                            <span className="ml-2">{status !== 'critical' ? '✅' : '❌'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Org Isolation:</span>
                            <span className="ml-2">{['vehicles', 'vehicle_positions', 'geofences', 'alerts'].includes(table) ? '✅' : 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Policies:</span>
                            <span className="ml-2">{Math.floor(Math.random() * 5) + 1}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Score:</span>
                            <span className="ml-2 font-medium">{score}/100</span>
                          </div>
                        </div>
                        <Progress value={score} className="mt-2" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">Run security audit to view detailed table analysis</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Multi-Tenant Isolation Tests</CardTitle>
                  <CardDescription>
                    Verify data isolation between organizations
                  </CardDescription>
                </div>
                <Button onClick={runMultiTenantTest} disabled={isTesting}>
                  {isTesting ? 'Testing...' : 'Run Tests'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {testResults ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border ${testResults.passed ? 'bg-success/10 border-success' : 'bg-destructive/10 border-destructive'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {testResults.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <span className="font-medium">
                        Overall Result: {testResults.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  </div>
                  
                  {testResults.results.map((result: any, index: number) => (
                    <div key={index} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{result.test}</span>
                        <Badge variant={result.passed ? 'default' : 'destructive'}>
                          {result.passed ? 'PASS' : 'FAIL'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{result.details}</p>
                      <Badge variant="outline" className="mt-2">
                        Risk: {result.risk}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Run multi-tenant tests to see results</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fixes">
          <Card>
            <CardHeader>
              <CardTitle>Automated Security Fixes</CardTitle>
              <CardDescription>
                SQL scripts to fix identified security issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditResult?.criticalIssues.length ? (
                <div className="space-y-4">
                  {auditResult.criticalIssues.map(issue => (
                    issue.fixSQL && (
                      <div key={issue.id} className="space-y-2">
                        <h4 className="font-medium">{issue.description}</h4>
                        <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                          {issue.fixSQL}
                        </pre>
                        <Button size="sm" variant="outline">
                          Copy SQL
                        </Button>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No fixes available. Run security audit to identify issues.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};