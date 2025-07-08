import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  TestTube, 
  Hash, 
  Network, 
  MessageSquare, 
  Zap,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { md5 } from 'js-md5';

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  requestTime?: number;
  httpStatus?: number;
  rawResponse?: any;
}

export function GPS51APITester() {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    apiUrl: 'https://api.gps51.com/openapi'
  });
  
  const [testResults, setTestResults] = useState<{
    edgeFunction?: TestResult;
    directApi?: TestResult;
    hashValidation?: TestResult;
  }>({});
  
  const [isLoading, setIsLoading] = useState({
    edgeFunction: false,
    directApi: false,
    hashValidation: false
  });

  // Phase 2: MD5 Hash Validation
  const validateMD5Hash = () => {
    setIsLoading(prev => ({ ...prev, hashValidation: true }));
    
    try {
      const rawPassword = credentials.password;
      const jsmd5Hash = md5(rawPassword);
      
      // Test against known vectors
      const testVectors = [
        { input: 'test', expected: '098f6bcd4621d373cade4e832627b4f6' },
        { input: 'password', expected: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8' },
        { input: 'hello', expected: '5d41402abc4b2a76b9719d911017c592' }
      ];
      
      const vectorResults = testVectors.map(vector => ({
        input: vector.input,
        generated: md5(vector.input),
        expected: vector.expected,
        matches: md5(vector.input) === vector.expected
      }));
      
      const result: TestResult = {
        success: true,
        data: {
          userPassword: {
            raw: rawPassword,
            hashed: jsmd5Hash,
            length: jsmd5Hash.length,
            format: /^[a-f0-9]{32}$/.test(jsmd5Hash) ? 'valid' : 'invalid',
            isLowercase: jsmd5Hash === jsmd5Hash.toLowerCase()
          },
          testVectors: vectorResults,
          allVectorsPass: vectorResults.every(v => v.matches)
        }
      };
      
      setTestResults(prev => ({ ...prev, hashValidation: result }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        hashValidation: { 
          success: false, 
          error: error.message 
        } 
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, hashValidation: false }));
    }
  };

  // Phase 1 & 3: Edge Function Test with Full Logging
  const testEdgeFunction = async () => {
    setIsLoading(prev => ({ ...prev, edgeFunction: true }));
    
    try {
      const startTime = Date.now();
      const hashedPassword = md5(credentials.password);
      
      console.log('GPS51APITester: Testing Edge Function with:', {
        username: credentials.username,
        passwordLength: credentials.password.length,
        hashedPassword: hashedPassword,
        apiUrl: credentials.apiUrl,
        timestamp: new Date().toISOString()
      });
      
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'login',
          username: credentials.username,
          password: hashedPassword,
          from: 'WEB',
          type: 'USER',
          apiUrl: credentials.apiUrl
        }
      });
      
      const requestTime = Date.now() - startTime;
      
      const result: TestResult = {
        success: !error && data?.success,
        data: data,
        error: error?.message || data?.error,
        requestTime,
        rawResponse: { data, error }
      };
      
      console.log('GPS51APITester: Edge Function response:', result);
      setTestResults(prev => ({ ...prev, edgeFunction: result }));
      
    } catch (error) {
      console.error('GPS51APITester: Edge Function test failed:', error);
      setTestResults(prev => ({ 
        ...prev, 
        edgeFunction: { 
          success: false, 
          error: error.message,
          requestTime: Date.now()
        } 
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, edgeFunction: false }));
    }
  };

  // Phase 5: Direct API Test (Bypass Edge Function)
  const testDirectAPI = async () => {
    setIsLoading(prev => ({ ...prev, directApi: true }));
    
    try {
      const startTime = Date.now();
      const hashedPassword = md5(credentials.password);
      
      const payload = {
        username: credentials.username,
        password: hashedPassword,
        from: 'WEB',
        type: 'USER'
      };
      
      console.log('GPS51APITester: Direct API test payload:', payload);
      
      const response = await fetch(`${credentials.apiUrl}?action=login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Envio-GPS51-Tester/1.0'
        },
        body: JSON.stringify(payload)
      });
      
      const requestTime = Date.now() - startTime;
      const responseText = await response.text();
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }
      
      const result: TestResult = {
        success: response.ok && responseData?.status === 0,
        data: responseData,
        error: !response.ok ? `HTTP ${response.status}: ${response.statusText}` : 
               responseData?.status !== 0 ? responseData?.message || responseData?.cause : undefined,
        requestTime,
        httpStatus: response.status,
        rawResponse: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData
        }
      };
      
      console.log('GPS51APITester: Direct API response:', result);
      setTestResults(prev => ({ ...prev, directApi: result }));
      
    } catch (error) {
      console.error('GPS51APITester: Direct API test failed:', error);
      setTestResults(prev => ({ 
        ...prev, 
        directApi: { 
          success: false, 
          error: error.message,
          requestTime: Date.now()
        } 
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, directApi: false }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getStatusIcon = (result?: TestResult) => {
    if (!result) return <Clock className="h-4 w-4 text-muted-foreground" />;
    return result.success ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (result?: TestResult) => {
    if (!result) return <Badge variant="outline">Not Run</Badge>;
    return result.success ? 
      <Badge variant="default">Success</Badge> : 
      <Badge variant="destructive">Failed</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            GPS51 API Testing & Debug Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={credentials.username}
                onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter GPS51 username"
              />
            </div>
            <div>
              <Label htmlFor="password">Password (Raw)</Label>
              <Input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter GPS51 password"
              />
            </div>
            <div>
              <Label htmlFor="apiUrl">API URL</Label>
              <Input
                id="apiUrl"
                value={credentials.apiUrl}
                onChange={(e) => setCredentials(prev => ({ ...prev, apiUrl: e.target.value }))}
                placeholder="GPS51 API URL"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="hash" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hash" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            MD5 Hash
          </TabsTrigger>
          <TabsTrigger value="edge" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Edge Function
          </TabsTrigger>
          <TabsTrigger value="direct" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Direct API
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hash">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Phase 2: MD5 Hash Validation</span>
                {getStatusIcon(testResults.hashValidation)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={validateMD5Hash} 
                disabled={isLoading.hashValidation || !credentials.password}
                className="w-full"
              >
                {isLoading.hashValidation ? 'Validating...' : 'Validate MD5 Hash'}
              </Button>
              
              {testResults.hashValidation && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    {getStatusBadge(testResults.hashValidation)}
                  </div>
                  
                  {testResults.hashValidation.success && testResults.hashValidation.data && (
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded">
                        <h4 className="font-medium mb-2">Your Password Hash:</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span>Raw:</span>
                            <code className="bg-background px-2 py-1 rounded">{testResults.hashValidation.data.userPassword.raw}</code>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>MD5:</span>
                            <div className="flex items-center gap-2">
                              <code className="bg-background px-2 py-1 rounded">{testResults.hashValidation.data.userPassword.hashed}</code>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => copyToClipboard(testResults.hashValidation.data.userPassword.hashed)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Length:</span>
                            <Badge variant={testResults.hashValidation.data.userPassword.length === 32 ? "default" : "destructive"}>
                              {testResults.hashValidation.data.userPassword.length}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Format:</span>
                            <Badge variant={testResults.hashValidation.data.userPassword.format === 'valid' ? "default" : "destructive"}>
                              {testResults.hashValidation.data.userPassword.format}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-muted rounded">
                        <h4 className="font-medium mb-2">Test Vector Validation:</h4>
                        <div className="space-y-1">
                          {testResults.hashValidation.data.testVectors.map((vector, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <span>"{vector.input}":</span>
                              {vector.matches ? 
                                <CheckCircle className="h-4 w-4 text-green-500" /> : 
                                <XCircle className="h-4 w-4 text-red-500" />
                              }
                            </div>
                          ))}
                        </div>
                        <div className="mt-2">
                          <Badge variant={testResults.hashValidation.data.allVectorsPass ? "default" : "destructive"}>
                            {testResults.hashValidation.data.allVectorsPass ? 'All tests passed' : 'Some tests failed'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edge">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Phase 1 & 3: Edge Function Test</span>
                {getStatusIcon(testResults.edgeFunction)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testEdgeFunction} 
                disabled={isLoading.edgeFunction || !credentials.username || !credentials.password}
                className="w-full"
              >
                {isLoading.edgeFunction ? 'Testing...' : 'Test Edge Function'}
              </Button>
              
              {testResults.edgeFunction && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span>Status:</span>
                      {getStatusBadge(testResults.edgeFunction)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Response Time:</span>
                      <Badge variant="outline">{testResults.edgeFunction.requestTime}ms</Badge>
                    </div>
                  </div>
                  
                  {testResults.edgeFunction.error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{testResults.edgeFunction.error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="p-3 bg-muted rounded">
                    <h4 className="font-medium mb-2">Full Response:</h4>
                    <pre className="text-xs overflow-auto max-h-64 bg-background p-2 rounded">
                      {JSON.stringify(testResults.edgeFunction.rawResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="direct">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Phase 5: Direct API Test</span>
                {getStatusIcon(testResults.directApi)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This test bypasses the Edge Function and calls GPS51 API directly. May be blocked by CORS.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={testDirectAPI} 
                disabled={isLoading.directApi || !credentials.username || !credentials.password}
                className="w-full"
              >
                {isLoading.directApi ? 'Testing...' : 'Test Direct API'}
              </Button>
              
              {testResults.directApi && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center justify-between">
                      <span>Status:</span>
                      {getStatusBadge(testResults.directApi)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>HTTP Status:</span>
                      <Badge variant={testResults.directApi.httpStatus === 200 ? "default" : "destructive"}>
                        {testResults.directApi.httpStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Response Time:</span>
                      <Badge variant="outline">{testResults.directApi.requestTime}ms</Badge>
                    </div>
                  </div>
                  
                  {testResults.directApi.error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{testResults.directApi.error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="p-3 bg-muted rounded">
                    <h4 className="font-medium mb-2">Full Response:</h4>
                    <pre className="text-xs overflow-auto max-h-64 bg-background p-2 rounded">
                      {JSON.stringify(testResults.directApi.rawResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Phase 4: Response Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    MD5 Validation
                  </h4>
                  <div className="space-y-1 text-sm">
                    {getStatusBadge(testResults.hashValidation)}
                    {testResults.hashValidation?.error && (
                      <p className="text-red-500">{testResults.hashValidation.error}</p>
                    )}
                  </div>
                </div>
                
                <div className="p-3 border rounded">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Edge Function
                  </h4>
                  <div className="space-y-1 text-sm">
                    {getStatusBadge(testResults.edgeFunction)}
                    {testResults.edgeFunction?.error && (
                      <p className="text-red-500">{testResults.edgeFunction.error}</p>
                    )}
                  </div>
                </div>
                
                <div className="p-3 border rounded">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Direct API
                  </h4>
                  <div className="space-y-1 text-sm">
                    {getStatusBadge(testResults.directApi)}
                    {testResults.directApi?.error && (
                      <p className="text-red-500">{testResults.directApi.error}</p>
                    )}
                  </div>
                </div>
              </div>
              
              {(testResults.edgeFunction || testResults.directApi) && (
                <div className="space-y-4">
                  <h4 className="font-medium">Comparison Analysis:</h4>
                  
                  {testResults.edgeFunction && testResults.directApi && (
                    <div className="p-3 bg-muted rounded">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <strong>Edge Function:</strong>
                          <ul className="mt-1 space-y-1">
                            <li>Success: {testResults.edgeFunction.success ? 'Yes' : 'No'}</li>
                            <li>Time: {testResults.edgeFunction.requestTime}ms</li>
                            <li>Error: {testResults.edgeFunction.error || 'None'}</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Direct API:</strong>
                          <ul className="mt-1 space-y-1">
                            <li>Success: {testResults.directApi.success ? 'Yes' : 'No'}</li>
                            <li>Time: {testResults.directApi.requestTime}ms</li>
                            <li>HTTP: {testResults.directApi.httpStatus}</li>
                            <li>Error: {testResults.directApi.error || 'None'}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-3 border rounded">
                    <h5 className="font-medium mb-2">Troubleshooting Recommendations:</h5>
                    <div className="space-y-2 text-sm">
                      {!testResults.hashValidation?.success && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            MD5 hash validation failed. Check your MD5 implementation.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {testResults.directApi?.httpStatus === 500 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            GPS51 API returning HTTP 500. Check request payload format and parameters.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {testResults.edgeFunction?.success !== testResults.directApi?.success && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            Edge Function and Direct API results differ. Check Edge Function implementation.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}