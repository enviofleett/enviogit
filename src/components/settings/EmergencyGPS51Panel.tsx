import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { EmergencyGPS51Dashboard } from '@/components/dashboard/EmergencyGPS51Dashboard';

export const EmergencyGPS51Panel = () => {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Emergency GPS51 Access
        </CardTitle>
        <CardDescription>
          Direct GPS51 authentication with rate limiting and API protection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Emergency Mode:</strong> This panel provides direct access to GPS51 with 
            aggressive rate limiting and API protection. Only use when the main authentication 
            system is unavailable.
          </AlertDescription>
        </Alert>
        
        <EmergencyGPS51Dashboard apiUrl="https://api.gps51.com/openapi" />
      </CardContent>
    </Card>
  );
};