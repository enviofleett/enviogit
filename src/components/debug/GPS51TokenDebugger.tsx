/**
 * GPS51 Token Debugging Component
 * Helps diagnose authentication token issues across the application
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Eye, EyeOff } from 'lucide-react';

export const GPS51TokenDebugger: React.FC = () => {
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [showTokens, setShowTokens] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const refreshTokenInfo = () => {
    try {
      // Check sessionStorage token (EmergencyGPS51Client)
      const sessionToken = sessionStorage.getItem('gps51_token');
      
      // Check localStorage token (GPS51TokenManager)
      const localStorageToken = localStorage.getItem('gps51_token');
      let localTokenData = null;
      if (localStorageToken) {
        try {
          localTokenData = JSON.parse(localStorageToken);
        } catch (e) {
          localTokenData = { error: 'Invalid JSON' };
        }
      }

      // Check auth state sync
      const authStateSync = localStorage.getItem('gps51_simple_auth_state');
      let authSyncData = null;
      if (authStateSync) {
        try {
          authSyncData = JSON.parse(authStateSync);
        } catch (e) {
          authSyncData = { error: 'Invalid JSON' };
        }
      }

      // Check credentials
      const credentials = localStorage.getItem('gps51_credentials');
      let credentialsData = null;
      if (credentials) {
        try {
          credentialsData = JSON.parse(credentials);
        } catch (e) {
          credentialsData = { error: 'Invalid JSON' };
        }
      }

      setTokenInfo({
        sessionStorage: {
          token: sessionToken,
          present: !!sessionToken,
          length: sessionToken?.length || 0
        },
        localStorage: {
          token: localTokenData,
          present: !!localTokenData,
          isValid: localTokenData && localTokenData.access_token && localTokenData.expires_at,
          isExpired: localTokenData?.expires_at ? new Date(localTokenData.expires_at).getTime() < Date.now() : null
        },
        authSync: {
          data: authSyncData,
          present: !!authSyncData,
          isAuthenticated: authSyncData?.isAuthenticated || false,
          username: authSyncData?.username || 'None'
        },
        credentials: {
          present: !!credentialsData,
          username: credentialsData?.username || 'None',
          hasPassword: !!credentialsData?.password,
          apiUrl: credentialsData?.apiUrl || 'None'
        },
        timestamp: new Date()
      });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('GPS51TokenDebugger: Error refreshing token info:', error);
      setTokenInfo({ error: error.message });
    }
  };

  useEffect(() => {
    refreshTokenInfo();
  }, []);

  const getTokenStatus = () => {
    if (!tokenInfo) return 'loading';
    
    if (tokenInfo.error) return 'error';
    
    const hasSessionToken = tokenInfo.sessionStorage.present;
    const hasLocalToken = tokenInfo.localStorage.present && tokenInfo.localStorage.isValid;
    const isAuthSynced = tokenInfo.authSync.isAuthenticated;
    const hasCredentials = tokenInfo.credentials.present;
    
    if (hasSessionToken && hasLocalToken && isAuthSynced && hasCredentials) {
      return tokenInfo.localStorage.isExpired ? 'expired' : 'good';
    } else if (hasCredentials) {
      return 'partial';
    } else {
      return 'missing';
    }
  };

  const status = getTokenStatus();
  const statusColor = {
    loading: 'bg-gray-500',
    good: 'bg-green-500',
    partial: 'bg-yellow-500',
    expired: 'bg-orange-500',
    missing: 'bg-red-500',
    error: 'bg-red-600'
  }[status];

  const statusText = {
    loading: 'Loading...',
    good: 'All tokens synchronized',
    partial: 'Incomplete token state',
    expired: 'Tokens expired',
    missing: 'No authentication data',
    error: 'Error reading tokens'
  }[status];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>GPS51 Token Debugger</span>
            <Badge className={statusColor}>{statusText}</Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowTokens(!showTokens)}
              variant="outline"
              size="sm"
            >
              {showTokens ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button onClick={refreshTokenInfo} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tokenInfo && !tokenInfo.error ? (
          <div className="space-y-4">
            <div className="text-xs text-gray-500">
              Last updated: {lastUpdate.toLocaleString()}
            </div>
            
            {/* Session Storage */}
            <div className="border rounded p-3">
              <div className="font-medium text-sm">Session Storage (EmergencyGPS51Client)</div>
              <div className="text-xs mt-1">
                <div>Present: {tokenInfo.sessionStorage.present ? '✅' : '❌'}</div>
                <div>Length: {tokenInfo.sessionStorage.length}</div>
                {showTokens && tokenInfo.sessionStorage.token && (
                  <div className="mt-1 font-mono text-xs break-all bg-gray-100 p-1 rounded">
                    {tokenInfo.sessionStorage.token.substring(0, 50)}...
                  </div>
                )}
              </div>
            </div>

            {/* Local Storage */}
            <div className="border rounded p-3">
              <div className="font-medium text-sm">Local Storage (GPS51TokenManager)</div>
              <div className="text-xs mt-1">
                <div>Present: {tokenInfo.localStorage.present ? '✅' : '❌'}</div>
                <div>Valid: {tokenInfo.localStorage.isValid ? '✅' : '❌'}</div>
                <div>Expired: {tokenInfo.localStorage.isExpired === null ? 'Unknown' : tokenInfo.localStorage.isExpired ? '❌' : '✅'}</div>
                {showTokens && tokenInfo.localStorage.token && (
                  <div className="mt-1 font-mono text-xs bg-gray-100 p-1 rounded">
                    <div>Access Token: {tokenInfo.localStorage.token.access_token?.substring(0, 30)}...</div>
                    <div>Expires: {tokenInfo.localStorage.token.expires_at}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Auth Sync */}
            <div className="border rounded p-3">
              <div className="font-medium text-sm">Authentication Sync</div>
              <div className="text-xs mt-1">
                <div>Present: {tokenInfo.authSync.present ? '✅' : '❌'}</div>
                <div>Authenticated: {tokenInfo.authSync.isAuthenticated ? '✅' : '❌'}</div>
                <div>Username: {tokenInfo.authSync.username}</div>
              </div>
            </div>

            {/* Credentials */}
            <div className="border rounded p-3">
              <div className="font-medium text-sm">Stored Credentials</div>
              <div className="text-xs mt-1">
                <div>Present: {tokenInfo.credentials.present ? '✅' : '❌'}</div>
                <div>Username: {tokenInfo.credentials.username}</div>
                <div>Has Password: {tokenInfo.credentials.hasPassword ? '✅' : '❌'}</div>
                <div>API URL: {tokenInfo.credentials.apiUrl}</div>
              </div>
            </div>

            {/* Recommendations */}
            {status !== 'good' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <div className="font-medium text-sm text-yellow-800">Recommendations</div>
                <div className="text-xs mt-1 text-yellow-700">
                  {status === 'missing' && '1. Go to Settings → GPS51 and enter your credentials'}
                  {status === 'partial' && '1. Try logging out and logging back in'}
                  {status === 'expired' && '1. Refresh the page or re-authenticate'}
                  {status === 'error' && '1. Clear browser storage and re-authenticate'}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-red-600">
            Error: {tokenInfo?.error || 'Unknown error occurred'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};