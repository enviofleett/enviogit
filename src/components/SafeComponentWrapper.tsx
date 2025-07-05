import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  componentName: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Safe wrapper for individual components to prevent cascade failures
 */
export class SafeComponentWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`SafeComponentWrapper: ${this.props.componentName} failed:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-yellow-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {this.props.componentName} temporarily unavailable
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  {this.props.fallbackMessage || 'This component encountered an error and will be restored automatically.'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => this.setState({ hasError: false, error: undefined })}
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap any component with safe error handling
 */
export function withSafeWrapper<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  fallbackMessage?: string
) {
  return function SafeWrappedComponent(props: P) {
    return (
      <SafeComponentWrapper 
        componentName={componentName} 
        fallbackMessage={fallbackMessage}
      >
        <Component {...props} />
      </SafeComponentWrapper>
    );
  };
}