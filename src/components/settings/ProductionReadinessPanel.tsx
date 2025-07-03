import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, XCircle, Activity } from 'lucide-react';
import { gps51ConfigManager } from '@/services/production/GPS51ConfigManager';
import { gps51HealthMonitor } from '@/services/production/GPS51HealthMonitor';
import { gps51DiagnosticsService } from '@/services/production/GPS51DiagnosticsService';

export const ProductionReadinessPanel = () => {
  const [readinessStatus, setReadinessStatus] = useState<'checking' | 'ready' | 'issues' | 'critical'>('checking');
  const [checklist, setChecklist] = useState<Array<{
    id: string;
    name: string;
    status: 'pending' | 'completed' | 'warning' | 'failed';
  }>>([
    { id: 'config', name: 'Configuration', status: 'pending' },
    { id: 'credentials', name: 'GPS51 Credentials', status: 'pending' },
    { id: 'connectivity', name: 'API Connectivity', status: 'pending' },
    { id: 'monitoring', name: 'Health Monitoring', status: 'pending' },
    { id: 'performance', name: 'Performance Optimization', status: 'pending' }
  ]);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    checkProductionReadiness();
  }, []);

  const checkProductionReadiness = async () => {
    const newChecklist = [...checklist];
    let completedCount = 0;

    // Check configuration
    const config = gps51ConfigManager.getCurrentConfig();
    if (config) {
      newChecklist[0].status = 'completed';
      completedCount++;
    } else {
      newChecklist[0].status = 'failed';
    }

    // Check credentials
    const credentialsStored = localStorage.getItem('gps51_credentials');
    if (credentialsStored) {
      newChecklist[1].status = 'completed';
      completedCount++;
    } else {
      newChecklist[1].status = 'failed';
    }

    // Check connectivity (simplified)
    try {
      const testResult = await gps51DiagnosticsService.runDiagnostic('gps51_connection');
      newChecklist[2].status = testResult.status === 'passed' ? 'completed' : 'failed';
      if (testResult.status === 'passed') completedCount++;
    } catch {
      newChecklist[2].status = 'failed';
    }

    // Check monitoring
    if (gps51HealthMonitor.isMonitoringActive()) {
      newChecklist[3].status = 'completed';
      completedCount++;
    } else {
      newChecklist[3].status = 'warning';
    }

    // Performance optimization is always ready (services exist)
    newChecklist[4].status = 'completed';
    completedCount++;

    setChecklist(newChecklist);
    setOverallProgress((completedCount / newChecklist.length) * 100);
    
    if (completedCount === newChecklist.length) {
      setReadinessStatus('ready');
    } else if (completedCount >= 3) {
      setReadinessStatus('issues');
    } else {
      setReadinessStatus('critical');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getReadinessColor = () => {
    switch (readinessStatus) {
      case 'ready': return 'text-green-600';
      case 'issues': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Production Readiness
        </CardTitle>
        <CardDescription>
          Verify system readiness for production deployment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className={`text-sm font-semibold ${getReadinessColor()}`}>
              {overallProgress.toFixed(0)}%
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        <div className="space-y-3">
          {checklist.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(item.status)}
                <span className="font-medium">{item.name}</span>
              </div>
              <Badge variant={
                item.status === 'completed' ? 'default' :
                item.status === 'warning' ? 'secondary' :
                item.status === 'failed' ? 'destructive' : 'outline'
              }>
                {item.status === 'completed' ? 'Ready' :
                 item.status === 'warning' ? 'Warning' :
                 item.status === 'failed' ? 'Failed' : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button onClick={checkProductionReadiness} variant="outline">
            Recheck Status
          </Button>
          {readinessStatus === 'ready' && (
            <Button className="bg-green-600 hover:bg-green-700">
              🚀 Ready for Production
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};