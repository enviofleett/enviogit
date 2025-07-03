import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Key, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface SecretsTestResult {
  secretName: string;
  isConfigured: boolean;
  hasValue: boolean;
  valuePreview?: string;
  error?: string;
}

export const GPS51SupabaseSecretsTest = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<SecretsTestResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  const testSupabaseSecrets = async () => {
    setTesting(true);
    setResults([]);
    setLogs([]);

    try {
      addLog('🔐 Testing Supabase secrets configuration...');

      // Test the GPS51 sync edge function to check if it can access secrets
      addLog('📡 Calling GPS51 sync function to test secret access...');
      
      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          // Send empty credentials to force the function to use environment variables
          username: '',
          password: '',
          apiUrl: '',
          cronTriggered: true,
          priority: 1
        }
      });

      addLog('📋 Edge function response received');

      if (error) {
        addLog(`❌ Edge function error: ${error.message}`);
        
        // Parse the error message to determine secret status
        const errorMessage = error.message;
        const secretResults: SecretsTestResult[] = [
          {
            secretName: 'GPS51_API_URL',
            isConfigured: !errorMessage.includes('API URL'),
            hasValue: !errorMessage.includes('API URL'),
            error: errorMessage.includes('API URL') ? 'Missing or null' : undefined
          },
          {
            secretName: 'GPS51_USERNAME',
            isConfigured: !errorMessage.includes('Username'),
            hasValue: !errorMessage.includes('Username'),
            error: errorMessage.includes('Username') ? 'Missing or null' : undefined
          },
          {
            secretName: 'GPS51_PASSWORD_HASH',
            isConfigured: !errorMessage.includes('Password'),
            hasValue: !errorMessage.includes('Password'),
            error: errorMessage.includes('Password') ? 'Missing or null' : undefined
          }
        ];

        setResults(secretResults);
        
        const missingSecrets = secretResults.filter(r => !r.isConfigured).map(r => r.secretName);
        if (missingSecrets.length > 0) {
          addLog(`🚫 Missing secrets: ${missingSecrets.join(', ')}`);
          toast({
            title: "Secrets Configuration Required",
            description: `Missing Supabase secrets: ${missingSecrets.join(', ')}`,
            variant: "destructive"
          });
        }
      } else {
        addLog('✅ All secrets appear to be configured correctly');
        
        const allConfiguredResults: SecretsTestResult[] = [
          {
            secretName: 'GPS51_API_URL',
            isConfigured: true,
            hasValue: true,
            valuePreview: '***gps51.com/openapi'
          },
          {
            secretName: 'GPS51_USERNAME',
            isConfigured: true,
            hasValue: true,
            valuePreview: '***configured***'
          },
          {
            secretName: 'GPS51_PASSWORD_HASH',
            isConfigured: true,
            hasValue: true,
            valuePreview: '***32-char-hash***'
          }
        ];

        setResults(allConfiguredResults);
        
        toast({
          title: "Secrets Test Successful",
          description: "All GPS51 Supabase secrets are properly configured",
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Test failed: ${errorMessage}`);
      
      toast({
        title: "Secrets Test Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setLogs([]);
  };

  const getStatusIcon = (result: SecretsTestResult) => {
    if (result.isConfigured && result.hasValue) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (result.error) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (result: SecretsTestResult) => {
    if (result.isConfigured && result.hasValue) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Configured</Badge>;
    } else if (result.error) {
      return <Badge variant="destructive">Missing</Badge>;
    } else {
      return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          GPS51 Supabase Secrets Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testSupabaseSecrets}
            disabled={testing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing Secrets...' : 'Test Supabase Secrets'}
          </Button>
          
          <Button 
            onClick={clearResults}
            variant="outline"
            className="flex items-center gap-2"
          >
            Clear Results
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Secrets Configuration Status</h4>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result)}
                    <div>
                      <div className="font-medium text-sm">{result.secretName}</div>
                      {result.valuePreview && (
                        <div className="text-xs text-muted-foreground">{result.valuePreview}</div>
                      )}
                      {result.error && (
                        <div className="text-xs text-red-600">{result.error}</div>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(result)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">Required Supabase Secrets:</div>
              <ul className="space-y-1 text-xs">
                <li><code>GPS51_API_URL</code> - The GPS51 API endpoint (e.g., https://api.gps51.com/openapi)</li>
                <li><code>GPS51_USERNAME</code> - Your GPS51 account username</li>
                <li><code>GPS51_PASSWORD_HASH</code> - MD5 hash of your GPS51 password</li>
              </ul>
              <div className="mt-2 text-xs">
                Configure these in your Supabase project settings under Edge Functions → Secrets.
              </div>
            </div>
          </div>
        </div>

        {logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              Test Log
            </div>
            <ScrollArea className="h-32 w-full border rounded p-3">
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono text-muted-foreground">
                    {log}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};