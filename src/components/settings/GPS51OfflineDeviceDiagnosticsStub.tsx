import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export const GPS51OfflineDeviceDiagnostics = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Device Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          Device diagnostics are temporarily unavailable while database schema is being updated.
        </div>
      </CardContent>
    </Card>
  );
};