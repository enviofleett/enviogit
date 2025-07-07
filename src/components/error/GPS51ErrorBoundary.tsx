import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  Shield, 
  Activity,
  Clock,
  Zap
} from 'lucide-react';
import { gps51ErrorHandler } from '@/services/gps51/GPS51CentralizedErrorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorStats: {
    total: number;
    byType: Record<string, number>;
    recentErrors: number;
    recoveryRate: number;
  };
  isRecovering: boolean;
}

export class GPS51ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorStats: {
        total: 0,
        byType: {},
        recentErrors: 0,
        recoveryRate: 0
      },
      isRecovering: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GPS51ErrorBoundary: Error caught:', error, errorInfo);
    
    this.setState({
      errorInfo,
      errorStats: gps51ErrorHandler.getErrorStats()
    });

    // Handle the error through centralized handler
    const gps51Error = gps51ErrorHandler.handleError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Attempt automatic recovery for certain error types
    if (gps51Error.recoverable && this.retryCount < this.maxRetries) {
      this.attemptRecovery(gps51Error.id);
    }
  }

  private attemptRecovery = async (errorId: string) => {
    this.setState({ isRecovering: true });
    this.retryCount++;

    try {
      console.log(`GPS51ErrorBoundary: Attempting recovery (${this.retryCount}/${this.maxRetries})`);
      
      // Wait a bit before recovery attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Find the error and attempt recovery
      const errorHistory = gps51ErrorHandler.getErrorHistory();
      const targetError = errorHistory.find(err => err.id === errorId);
      
      if (targetError) {
        const recovered = await gps51ErrorHandler.attemptRecovery(targetError, this.retryCount - 1);
        
        if (recovered) {
          console.log('GPS51ErrorBoundary: Automatic recovery successful');
          this.handleRetry();
          return;
        }
      }
      
      console.log('GPS51ErrorBoundary: Automatic recovery failed');
    } catch (recoveryError) {
      console.error('GPS51ErrorBoundary: Recovery attempt failed:', recoveryError);
    } finally {
      this.setState({ isRecovering: false });
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false
    });
    this.retryCount = 0;
  };

  private handleClearErrors = () => {
    gps51ErrorHandler.clearHistory();
    this.setState({
      errorStats: gps51ErrorHandler.getErrorStats()
    });
  };

  private getErrorSeverity = (): 'low' | 'medium' | 'high' => {
    const { errorStats } = this.state;
    
    if (errorStats.recentErrors > 10 || errorStats.recoveryRate < 50) {
      return 'high';
    } else if (errorStats.recentErrors > 5 || errorStats.recoveryRate < 80) {
      return 'medium';
    }
    
    return 'low';
  };

  private getErrorTypeDisplay = (type: string): { label: string; color: string } => {
    const typeMap: Record<string, { label: string; color: string }> = {
      rate_limit: { label: 'Rate Limit', color: 'bg-yellow-100 text-yellow-800' },
      authentication: { label: 'Authentication', color: 'bg-red-100 text-red-800' },
      network: { label: 'Network', color: 'bg-blue-100 text-blue-800' },
      circuit_breaker: { label: 'Circuit Breaker', color: 'bg-orange-100 text-orange-800' },
      api: { label: 'API Error', color: 'bg-purple-100 text-purple-800' },
      unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-800' }
    };
    
    return typeMap[type] || typeMap.unknown;
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const severity = this.getErrorSeverity();
      const { error, errorStats, isRecovering } = this.state;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <CardTitle className="text-red-900">
                      GPS51 System Error
                    </CardTitle>
                    <CardDescription>
                      The GPS tracking system encountered an unexpected error
                    </CardDescription>
                  </div>
                </div>
                <Badge 
                  className={
                    severity === 'high' ? 'bg-red-100 text-red-800' :
                    severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }
                >
                  {severity.toUpperCase()} SEVERITY
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Error Details */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error:</strong> {error?.message || 'Unknown error occurred'}
                </AlertDescription>
              </Alert>

              {/* System Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Total Errors</span>
                    </div>
                    <p className="text-2xl font-bold">{errorStats.total}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Recent (1h)</span>
                    </div>
                    <p className="text-2xl font-bold">{errorStats.recentErrors}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Recovery Rate</span>
                    </div>
                    <p className="text-2xl font-bold">{errorStats.recoveryRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">Status</span>
                    </div>
                    <Badge variant={isRecovering ? "default" : "secondary"}>
                      {isRecovering ? 'Recovering' : 'Error'}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Error Types Breakdown */}
              {Object.keys(errorStats.byType).length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-3">Error Types</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(errorStats.byType).map(([type, count]) => {
                      const typeInfo = this.getErrorTypeDisplay(type);
                      return (
                        <Badge key={type} className={typeInfo.color}>
                          {typeInfo.label}: {count}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recovery Status */}
              {isRecovering && (
                <Alert>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Attempting automatic recovery... ({this.retryCount}/{this.maxRetries})
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={this.handleRetry}
                  disabled={isRecovering}
                  className="flex items-center gap-2"
                >
                  {isRecovering ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {isRecovering ? 'Retrying...' : 'Retry'}
                </Button>

                <Button 
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>

                <Button 
                  variant="outline"
                  onClick={this.handleClearErrors}
                  className="flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Clear Error History
                </Button>

                <Button 
                  variant="outline"
                  onClick={() => window.open('/settings', '_blank')}
                  className="flex items-center gap-2"
                >
                  Settings
                </Button>
              </div>

              {/* Debug Information (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="text-xs text-gray-600">
                  <summary className="cursor-pointer font-medium mb-2">
                    Debug Information (Development Only)
                  </summary>
                  <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                    {error?.stack}
                    {'\n\nComponent Stack:'}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}