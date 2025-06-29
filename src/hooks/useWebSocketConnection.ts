import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onPositionUpdate?: (vehicleId: string, position: any) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export const useWebSocketConnection = (options: UseWebSocketOptions = {}) => {
  const {
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    onPositionUpdate,
    onConnectionChange
  } = options;

  const [connected, setConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedVehiclesRef = useRef<Set<string>>(new Set());

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `wss://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/gps51-realtime-ws`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setReconnectAttempts(0);
        onConnectionChange?.(true);

        // Resubscribe to vehicles after reconnection
        if (subscribedVehiclesRef.current.size > 0) {
          subscribeToVehicles(Array.from(subscribedVehiclesRef.current));
        }
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);

          switch (message.type) {
            case 'position_update':
              onPositionUpdate?.(message.vehicleId, message.position);
              break;
            case 'connection_established':
              console.log('WebSocket connection established:', message.clientId);
              break;
            case 'subscription_confirmed':
              console.log('Vehicle subscription confirmed:', message.vehicleIds);
              break;
            case 'pong':
              // Handle ping/pong for connection health
              break;
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socketRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        onConnectionChange?.(false);
        
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          console.log(`Attempting to reconnect in ${reconnectInterval}ms (attempt ${reconnectAttempts + 1})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
        onConnectionChange?.(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnected(false);
      onConnectionChange?.(false);
    }
  }, [autoReconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts, onConnectionChange, onPositionUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setConnected(false);
    setReconnectAttempts(0);
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn('WebSocket not connected, message not sent:', message);
    return false;
  }, []);

  const subscribeToVehicles = useCallback((vehicleIds: string[]) => {
    subscribedVehiclesRef.current = new Set(vehicleIds);
    sendMessage({
      type: 'subscribe_vehicles',
      vehicleIds
    });
  }, [sendMessage]);

  const requestVehicleUpdate = useCallback((vehicleIds: string[]) => {
    sendMessage({
      type: 'request_vehicle_update',
      vehicleIds
    });
  }, [sendMessage]);

  // Ping to keep connection alive
  useEffect(() => {
    if (!connected) return;

    const pingInterval = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, [connected, sendMessage]);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    connect,
    disconnect,
    sendMessage,
    subscribeToVehicles,
    requestVehicleUpdate,
    reconnectAttempts
  };
};
