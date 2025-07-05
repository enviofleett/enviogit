import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Loader2,
  Wifi,
  WifiOff
} from 'lucide-react';

interface SystemStatus {
  gps51: 'initializing' | 'ready' | 'not_configured' | 'error';
  message?: string;
  lastUpdate?: number;
}

export const SystemStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>({
    gps51: 'initializing'
  });

  useEffect(() => {
    const handleGPS51Ready = (event: CustomEvent) => {
      setStatus({
        gps51: 'ready',
        message: 'GPS51 system operational',
        lastUpdate: event.detail.timestamp
      });
    };

    const handleGPS51NotReady = (event: CustomEvent) => {
      setStatus({
        gps51: 'not_configured',
        message: event.detail.message || 'GPS51 not configured',
        lastUpdate: event.detail.timestamp
      });
    };

    const handleGPS51Error = (event: CustomEvent) => {
      setStatus({
        gps51: 'error',
        message: event.detail.error || 'GPS51 system error',
        lastUpdate: event.detail.timestamp
      });
    };

    window.addEventListener('gps51-system-ready', handleGPS51Ready as EventListener);
    window.addEventListener('gps51-system-not-ready', handleGPS51NotReady as EventListener);
    window.addEventListener('gps51-system-error', handleGPS51Error as EventListener);

    // Timeout for initialization
    const timeout = setTimeout(() => {
      if (status.gps51 === 'initializing') {
        setStatus({
          gps51: 'not_configured',
          message: 'GPS51 system initialization timeout'
        });
      }
    }, 15000);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('gps51-system-ready', handleGPS51Ready as EventListener);
      window.removeEventListener('gps51-system-not-ready', handleGPS51NotReady as EventListener);
      window.removeEventListener('gps51-system-error', handleGPS51Error as EventListener);
    };
  }, []);

  const getStatusDisplay = () => {
    switch (status.gps51) {
      case 'initializing':
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Initializing',
          variant: 'secondary' as const,
          color: 'text-blue-600'
        };
      case 'ready':
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          text: 'GPS51 Ready',
          variant: 'default' as const,
          color: 'text-green-600'
        };
      case 'not_configured':
        return {
          icon: <WifiOff className="w-3 h-3" />,
          text: 'Not Configured',
          variant: 'secondary' as const,
          color: 'text-yellow-600'
        };
      case 'error':
        return {
          icon: <XCircle className="w-3 h-3" />,
          text: 'System Error',
          variant: 'destructive' as const,
          color: 'text-red-600'
        };
      default:
        return {
          icon: <AlertTriangle className="w-3 h-3" />,
          text: 'Unknown',
          variant: 'outline' as const,
          color: 'text-gray-600'
        };
    }
  };

  const display = getStatusDisplay();

  return (
    <div className="flex items-center space-x-2">
      <Badge variant={display.variant} className="flex items-center space-x-1">
        <span className={display.color}>{display.icon}</span>
        <span className="text-xs">{display.text}</span>
      </Badge>
    </div>
  );
};