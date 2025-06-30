
import React from 'react';

interface CredentialsFormDebugProps {
  showDebug: boolean;
  debugInfo: any;
}

export const CredentialsFormDebug: React.FC<CredentialsFormDebugProps> = ({
  showDebug,
  debugInfo
}) => {
  if (!showDebug || !debugInfo) {
    return null;
  }

  return (
    <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">🐛 Debug Information</h4>
      <pre className="text-xs text-gray-600 overflow-auto max-h-40">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>
  );
};
