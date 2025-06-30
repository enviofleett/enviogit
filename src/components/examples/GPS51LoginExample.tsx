
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GPS51LoginService, GPS51LoginResult } from '@/services/gps51/GPS51LoginService';

/**
 * Example component demonstrating GPS51 login functionality
 */
export const GPS51LoginExample: React.FC = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    plainPassword: '',
    from: 'WEB',
    type: 'USER'
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GPS51LoginResult | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogin = async () => {
    if (!credentials.username || !credentials.plainPassword) {
      setResult({
        success: false,
        error: 'Please enter both username and password'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('Example: Starting GPS51 login test...');
      
      // Use the GPS51LoginService to authenticate
      const loginResult = await GPS51LoginService.login({
        username: credentials.username,
        plainPassword: credentials.plainPassword,
        from: credentials.from,
        type: credentials.type
      });

      console.log('Example: Login completed:', loginResult);
      setResult(loginResult);

    } catch (error) {
      console.error('Example: Login error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>GPS51 Login Test</CardTitle>
        <CardDescription>
          Test the GPS51 API login functionality with MD5 password hashing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={credentials.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            placeholder="Enter GPS51 username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={credentials.plainPassword}
            onChange={(e) => handleInputChange('plainPassword', e.target.value)}
            placeholder="Enter plain text password"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <select
              id="from"
              value={credentials.from}
              onChange={(e) => handleInputChange('from', e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="WEB">WEB</option>
              <option value="ANDROID">ANDROID</option>
              <option value="IPHONE">IPHONE</option>
              <option value="WEIXIN">WEIXIN</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={credentials.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="USER">USER</option>
              <option value="DEVICE">DEVICE</option>
            </select>
          </div>
        </div>

        <Button 
          onClick={handleLogin} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Logging in...' : 'Test Login'}
        </Button>

        {result && (
          <Alert className={result.success ? 'border-green-500' : 'border-red-500'}>
            <AlertDescription>
              {result.success ? (
                <div className="space-y-1">
                  <p className="text-green-600 font-semibold">✅ Login Successful!</p>
                  <p className="text-sm">Token: {result.token?.substring(0, 20)}...</p>
                  {result.user && (
                    <div className="text-sm">
                      <p>User: {result.user.username}</p>
                      <p>Type: {result.user.usertype}</p>
                      {result.user.companyname && <p>Company: {result.user.companyname}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-red-600 font-semibold">❌ Login Failed</p>
                  <p className="text-sm">Error: {result.error}</p>
                  {result.status !== undefined && <p className="text-sm">Status: {result.status}</p>}
                  {result.cause && <p className="text-sm">Cause: {result.cause}</p>}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
