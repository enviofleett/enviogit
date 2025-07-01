
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DebugInfo {
  timestamp: string;
  formData: any;
  validation: any;
  configStatus: any;
}

interface CredentialsFormDebugProps {
  showDebug: boolean;
  debugInfo: DebugInfo;
}

export const CredentialsFormDebug: React.FC<CredentialsFormDebugProps> = ({
  showDebug,
  debugInfo
}) => {
  if (!showDebug) return null;

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="text-sm text-gray-600">Debug Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-1">Form Data:</h4>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(debugInfo.formData, null, 2)}
            </pre>
          </div>
          
          {debugInfo.validation && (
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-1">Validation:</h4>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(debugInfo.validation, null, 2)}
              </pre>
            </div>
          )}
          
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-1">Config Status:</h4>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(debugInfo.configStatus, null, 2)}
            </pre>
          </div>
          
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-1">Timestamp:</h4>
            <p className="text-xs text-gray-600">{debugInfo.timestamp}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
