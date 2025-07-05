import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApplicationLogsPanel } from '@/components/developers/ApplicationLogsPanel';
import { EdgeFunctionInsights } from '@/components/developers/EdgeFunctionInsights';
import { ApiCallMonitor } from '@/components/developers/ApiCallMonitor';
import { DatabaseActivityMirror } from '@/components/developers/DatabaseActivityMirror';
import { DataFlowVisualization } from '@/components/developers/DataFlowVisualization';
import { Shield } from 'lucide-react';

const DevelopersPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Developers Console</h1>
              <p className="text-muted-foreground">
                Monitor, debug, and analyze system operations in real-time
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="logs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="logs">Application Logs</TabsTrigger>
            <TabsTrigger value="functions">Edge Functions</TabsTrigger>
            <TabsTrigger value="api">API Monitor</TabsTrigger>
            <TabsTrigger value="database">Database Activity</TabsTrigger>
            <TabsTrigger value="flow">Data Flow</TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            <ApplicationLogsPanel />
          </TabsContent>

          <TabsContent value="functions">
            <EdgeFunctionInsights />
          </TabsContent>

          <TabsContent value="api">
            <ApiCallMonitor />
          </TabsContent>

          <TabsContent value="database">
            <DatabaseActivityMirror />
          </TabsContent>

          <TabsContent value="flow">
            <DataFlowVisualization />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DevelopersPage;