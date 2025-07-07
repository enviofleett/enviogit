import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, AlertTriangle, Shield, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const UnauthenticatedDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Fleet Management Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your GPS51 fleet tracking system
          </p>
        </div>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Authentication Required
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Please authenticate with GPS51 to access your fleet data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2"
                size="lg"
              >
                <Settings className="h-4 w-4" />
                Go to Settings → GPS51
              </Button>
              <Button
                onClick={() => navigate('/settings', { state: { tab: 'emergency' } })}
                variant="outline"
                className="flex items-center gap-2"
                size="lg"
              >
                <Shield className="h-4 w-4" />
                Emergency Mode
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Primary Login
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Use the Settings → GPS51 tab for comprehensive authentication with testing and diagnostics.
              </p>
              <Badge variant="default">Recommended</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Emergency Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Emergency mode with rate limiting and API protection for critical situations.
              </p>
              <Badge variant="destructive">Emergency Only</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Configure GPS51 credentials, test connections, and manage devices.
              </p>
              <Badge variant="secondary">Setup Required</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};