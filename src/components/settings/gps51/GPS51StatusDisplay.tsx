
import React from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { SessionStatus } from '@/hooks/useGPS51SessionBridge';

interface GPS51StatusDisplayProps {
  status: SessionStatus;
  showDebug: boolean;
}

export const GPS51StatusDisplay: React.FC<GPS51StatusDisplayProps> = ({ status, showDebug }) => {
  const getConnectionStatusIcon = () => {
    if (status.isAuthenticated && status.connectionHealth === 'good') {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (status.error) {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
    return null;
  };

  return (
    <>
      {status.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            ❌ Connection failed: {status.error}
          </p>
          {showDebug && (
            <details className="mt-2">
              <summary className="text-xs text-red-600 cursor-pointer">Show technical details</summary>
              <div className="mt-1 text-xs text-red-600">
                Last attempt: {new Date().toLocaleString()}<br/>
                Status: {status.syncStatus}<br/>
                Health: {status.connectionHealth}
              </div>
            </details>
          )}
        </div>
      )}

      {status.isAuthenticated && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            ✅ Connected to GPS51 API
            <span className="block text-xs mt-1">
              Connection Health: {status.connectionHealth.toUpperCase()}
            </span>
            <span className="block text-xs mt-1">
              Sync Status: {status.syncStatus.toUpperCase()}
            </span>
            {status.lastSync && (
              <span className="block text-xs mt-1">
                Last sync: {status.lastSync.toLocaleString()}
              </span>
            )}
          </p>
        </div>
      )}

      {status.syncStatus === 'syncing' && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            🔄 Syncing data from GPS51...
          </p>
        </div>
      )}

      {getConnectionStatusIcon()}
    </>
  );
};
