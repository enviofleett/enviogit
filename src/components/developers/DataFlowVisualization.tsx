import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GitBranch, 
  Smartphone, 
  Globe, 
  Server, 
  Database,
  Monitor,
  ArrowRight,
  ArrowDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Eye,
  Code2
} from 'lucide-react';

interface FlowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: 'active' | 'warning' | 'success' | 'inactive';
  observability: string[];
  technicalDetails: string[];
}

const DATA_FLOW_STEPS: FlowStep[] = [
  {
    id: 'gps-device',
    title: 'GPS Device',
    description: 'Fleet vehicles equipped with GPS51-compatible tracking devices',
    icon: Smartphone,
    status: 'active',
    observability: [
      'Device last seen timestamps in GPS51 API',
      'Position update frequency',
      'Signal strength and accuracy metrics'
    ],
    technicalDetails: [
      'Hardware: GPS51-compatible tracking devices',
      'Communication: GPRS/4G cellular connection',
      'Data: Position, speed, ignition status, fuel level',
      'Frequency: Real-time updates based on movement'
    ]
  },
  {
    id: 'gps51-api',
    title: 'GPS51 Platform',
    description: 'Third-party GPS tracking platform (api.gps51.com)',
    icon: Globe,
    status: 'warning',
    observability: [
      'API Call Monitor - Request/response tracking',
      'Rate limiting detection (status 8902)',
      'Authentication token management',
      'Response time monitoring'
    ],
    technicalDetails: [
      'Endpoint: https://api.gps51.com/openapi',
      'Authentication: Username/password with token refresh',
      'Rate Limits: Aggressive throttling detected',
      'Key Actions: login, querymonitorlist, lastposition'
    ]
  },
  {
    id: 'edge-functions',
    title: 'Supabase Edge Functions',
    description: 'Serverless functions handling GPS51 integration and data processing',
    icon: Server,
    status: 'success',
    observability: [
      'Edge Function Insights - Execution monitoring',
      'Performance metrics and error rates',
      'Memory usage and execution time',
      'Function invocation logs'
    ],
    technicalDetails: [
      'Functions: gps51-auth, gps51-proxy, gps51-sync',
      'Runtime: Deno with TypeScript',
      'Triggers: Scheduled (cron) and on-demand',
      'Features: Rate limiting, caching, error handling'
    ]
  },
  {
    id: 'supabase-db',
    title: 'Supabase Database',
    description: 'PostgreSQL database storing processed fleet data',
    icon: Database,
    status: 'success',
    observability: [
      'Database Activity Mirror - Real-time changes',
      'Application Logs - Insert/update operations',
      'RLS policy enforcement monitoring',
      'Query performance tracking'
    ],
    technicalDetails: [
      'Engine: PostgreSQL with Row Level Security',
      'Tables: vehicles, vehicle_positions, organizations',
      'Features: Real-time subscriptions, JSONB data',
      'Indexes: Optimized for time-series queries'
    ]
  },
  {
    id: 'realtime',
    title: 'Supabase Realtime',
    description: 'WebSocket-based real-time data synchronization',
    icon: Zap,
    status: 'active',
    observability: [
      'Real-time connection status',
      'WebSocket message frequency',
      'Client subscription management',
      'Data propagation latency'
    ],
    technicalDetails: [
      'Protocol: WebSockets with Phoenix channels',
      'Events: INSERT, UPDATE, DELETE on monitored tables',
      'Filtering: Row-level security applied',
      'Scaling: Automatic connection management'
    ]
  },
  {
    id: 'web-app',
    title: 'Web Application',
    description: 'React-based fleet management dashboard',
    icon: Monitor,
    status: 'success',
    observability: [
      'Browser DevTools - Network requests',
      'Console logs and error tracking',
      'Component state management',
      'User interaction analytics'
    ],
    technicalDetails: [
      'Framework: React with TypeScript',
      'State: React hooks and Supabase client',
      'UI: Tailwind CSS with shadcn/ui components',
      'Maps: Integration with MapTiler/Leaflet'
    ]
  }
];

const MONITORING_SECTIONS = [
  {
    name: 'Application Logs',
    description: 'Centralized logging with AI-powered error analysis',
    monitors: ['Edge function errors', 'Database operation logs', 'Authentication failures'],
    color: 'text-blue-500'
  },
  {
    name: 'Edge Function Insights',
    description: 'Function performance and health monitoring',
    monitors: ['Execution duration', 'Success rates', 'Memory usage', 'Error patterns'],
    color: 'text-green-500'
  },
  {
    name: 'API Call Monitor',
    description: 'GPS51 API interaction tracking and analysis',
    monitors: ['Request/response payloads', 'Rate limiting detection', 'Response time trends'],
    color: 'text-orange-500'
  },
  {
    name: 'Database Activity Mirror',
    description: 'Real-time database change monitoring',
    monitors: ['Table insert/update/delete events', 'Data validation', 'Performance metrics'],
    color: 'text-purple-500'
  }
];

export const DataFlowVisualization = () => {
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'active':
        return <Activity className="w-5 h-5 text-primary animate-pulse" />;
      case 'inactive':
        return <Clock className="w-5 h-5 text-muted-foreground" />;
      default:
        return <Activity className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-success">Healthy</Badge>;
      case 'warning':
        return <Badge variant="destructive">Issues Detected</Badge>;
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GitBranch className="w-5 h-5" />
            <span>End-to-End Data Flow</span>
          </CardTitle>
          <CardDescription>
            Comprehensive visualization of fleet data journey from GPS devices to the web dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-6">
            This diagram illustrates how GPS data flows through our system, highlighting key observability 
            points that correspond to the monitoring sections in this Developers Console.
          </div>
        </CardContent>
      </Card>

      {/* Data Flow Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DATA_FLOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isSelected = selectedStep === step.id;
                
                return (
                  <div key={step.id}>
                    <div 
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedStep(isSelected ? null : step.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{step.title}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(step.status)}
                          {getStatusBadge(step.status)}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                    
                    {index < DATA_FLOW_STEPS.length - 1 && (
                      <div className="flex justify-center py-2">
                        <ArrowDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedStep ? 'Step Details' : 'Select a Step'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedStep ? (
              (() => {
                const step = DATA_FLOW_STEPS.find(s => s.id === selectedStep);
                if (!step) return null;
                
                const Icon = step.icon;
                
                return (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-3">
                      <Icon className="w-6 h-6" />
                      <div>
                        <h3 className="font-semibold">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3 flex items-center">
                        <Eye className="w-4 h-4 mr-2" />
                        Observability Points
                      </h4>
                      <div className="space-y-2">
                        {step.observability.map((point, idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <div className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
                            <span className="text-sm">{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3 flex items-center">
                        <Code2 className="w-4 h-4 mr-2" />
                        Technical Details
                      </h4>
                      <div className="space-y-2">
                        {step.technicalDetails.map((detail, idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <div className="w-1 h-1 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">{detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Click on any step in the flow diagram to view detailed information about 
                that component and its observability points.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monitoring Correlation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Monitoring Section Correlation</span>
          </CardTitle>
          <CardDescription>
            How each monitoring section in this Developers Console correlates with the data flow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MONITORING_SECTIONS.map((section) => (
              <Card key={section.name} className="border-l-4 border-l-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${section.color.replace('text-', 'bg-')}`} />
                    <h4 className="font-medium">{section.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{section.description}</p>
                  <div className="space-y-1">
                    {section.monitors.map((monitor, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs">{monitor}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>System Health Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DATA_FLOW_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="text-center">
                  <div className="flex justify-center mb-2">
                    <Icon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium mb-1">{step.title}</div>
                  <div className="flex justify-center">
                    {getStatusBadge(step.status)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};