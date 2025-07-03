import { supabase } from '@/integrations/supabase/client';

export interface WebSocketMessage {
  type: 'ping' | 'pong' | 'data' | 'error' | 'connected' | 'disconnected';
  timestamp: number;
  data?: any;
  source?: string;
  id?: string;
}

export interface WebSocketConfig {
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  messageQueueSize: number;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionId: string | null;
  lastHeartbeat: number;
  messagesSent: number;
  messagesReceived: number;
  reconnectAttempts: number;
  error: string | null;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class GPS51WebSocketManager {
  private config: WebSocketConfig;
  private state: WebSocketState;
  private socket: WebSocket | null = null;
  private eventHandlers = new Map<string, Set<WebSocketEventHandler>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private isDestroyed = false;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      messageQueueSize: 100,
      ...config
    };

    this.state = {
      isConnected: false,
      isConnecting: false,
      connectionId: null,
      lastHeartbeat: 0,
      messagesSent: 0,
      messagesReceived: 0,
      reconnectAttempts: 0,
      error: null
    };
  }

  async connect(): Promise<boolean> {
    if (this.isDestroyed) {
      throw new Error('WebSocket manager has been destroyed');
    }

    if (this.state.isConnected || this.state.isConnecting) {
      console.warn('GPS51WebSocketManager: Already connected or connecting');
      return this.state.isConnected;
    }

    try {
      this.state.isConnecting = true;
      this.state.error = null;
      
      console.log('GPS51WebSocketManager: Establishing WebSocket connection...');

      // Create WebSocket connection through Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('gps51-realtime-ws', {
        method: 'GET',
        headers: {
          'Connection': 'Upgrade',
          'Upgrade': 'websocket'
        }
      });

      if (error) {
        throw new Error(`Failed to establish WebSocket: ${error.message}`);
      }

      // For now, simulate WebSocket connection since we're in browser environment
      // In production, this would connect to the actual WebSocket endpoint
      await this.simulateWebSocketConnection();

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      console.error('GPS51WebSocketManager: Connection failed:', errorMessage);
      
      this.state.isConnecting = false;
      this.state.error = errorMessage;
      
      if (this.config.autoReconnect && this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
      
      return false;
    }
  }

  private async simulateWebSocketConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Simulate WebSocket-like behavior using EventSource or polling
        // This is a simplified implementation for the browser environment
        
        this.state.isConnected = true;
        this.state.isConnecting = false;
        this.state.connectionId = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.state.reconnectAttempts = 0;
        this.state.lastHeartbeat = Date.now();

        console.log('GPS51WebSocketManager: WebSocket connection simulated successfully');
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Emit connected event
        this.emitEvent('connected', {
          type: 'connected',
          timestamp: Date.now(),
          data: { connectionId: this.state.connectionId }
        });

        // Simulate receiving periodic messages
        this.simulateIncomingMessages();
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  private simulateIncomingMessages(): void {
    // Simulate receiving data messages periodically
    const messageInterval = setInterval(() => {
      if (!this.state.isConnected || this.isDestroyed) {
        clearInterval(messageInterval);
        return;
      }

      // Simulate receiving GPS position updates
      const mockMessage: WebSocketMessage = {
        type: 'data',
        timestamp: Date.now(),
        data: {
          type: 'position_update',
          deviceId: `device_${Math.floor(Math.random() * 10)}`,
          lat: 40.7128 + (Math.random() - 0.5) * 0.1,
          lng: -74.0060 + (Math.random() - 0.5) * 0.1,
          speed: Math.random() * 60,
          course: Math.random() * 360
        },
        source: 'gps51_api',
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.handleIncomingMessage(mockMessage);
    }, 10000 + Math.random() * 20000); // Random interval between 10-30 seconds
  }

  disconnect(): void {
    console.log('GPS51WebSocketManager: Disconnecting...');
    
    this.stopHeartbeat();
    this.stopReconnect();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.state.connectionId = null;
    
    this.emitEvent('disconnected', {
      type: 'disconnected',
      timestamp: Date.now()
    });
  }

  destroy(): void {
    console.log('GPS51WebSocketManager: Destroying...');
    
    this.isDestroyed = true;
    this.disconnect();
    this.eventHandlers.clear();
    this.messageQueue = [];
  }

  // Event handling
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  private emitEvent(event: string, message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('GPS51WebSocketManager: Event handler error:', error);
        }
      });
    }
  }

  // Message handling
  send(message: WebSocketMessage): boolean {
    if (!this.state.isConnected) {
      console.warn('GPS51WebSocketManager: Cannot send message - not connected');
      
      // Queue message if not connected
      if (this.messageQueue.length < this.config.messageQueueSize) {
        this.messageQueue.push(message);
      }
      
      return false;
    }

    try {
      // In a real implementation, this would send through the WebSocket
      console.log('GPS51WebSocketManager: Sending message:', message);
      
      this.state.messagesSent++;
      return true;
    } catch (error) {
      console.error('GPS51WebSocketManager: Failed to send message:', error);
      return false;
    }
  }

  private handleIncomingMessage(message: WebSocketMessage): void {
    this.state.messagesReceived++;
    
    // Add to recent messages queue
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.config.messageQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }
    
    // Handle different message types
    switch (message.type) {
      case 'ping':
        this.handlePing(message);
        break;
      case 'pong':
        this.handlePong(message);
        break;
      case 'data':
        this.emitEvent('data', message);
        break;
      case 'error':
        this.handleError(message);
        break;
      default:
        this.emitEvent(message.type, message);
    }
  }

  private handlePing(message: WebSocketMessage): void {
    // Respond to ping with pong
    this.send({
      type: 'pong',
      timestamp: Date.now(),
      data: message.data
    });
  }

  private handlePong(message: WebSocketMessage): void {
    this.state.lastHeartbeat = Date.now();
    console.log('GPS51WebSocketManager: Heartbeat received');
  }

  private handleError(message: WebSocketMessage): void {
    console.error('GPS51WebSocketManager: Received error message:', message.data);
    this.state.error = message.data?.message || 'Unknown WebSocket error';
    this.emitEvent('error', message);
  }

  // Heartbeat management
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.state.isConnected) {
        this.send({
          type: 'ping',
          timestamp: Date.now()
        });
        
        // Check if we haven't received a pong recently
        const timeSinceLastHeartbeat = Date.now() - this.state.lastHeartbeat;
        if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
          console.warn('GPS51WebSocketManager: Heartbeat timeout, reconnecting...');
          this.reconnect();
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Reconnection management
  private scheduleReconnect(): void {
    if (!this.config.autoReconnect || this.isDestroyed) return;
    
    this.stopReconnect();
    
    this.state.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.state.reconnectAttempts - 1);
    
    console.log(`GPS51WebSocketManager: Scheduling reconnect attempt ${this.state.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnect();
    }, Math.min(delay, 30000)); // Cap at 30 seconds
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async reconnect(): Promise<void> {
    if (this.isDestroyed) return;
    
    console.log('GPS51WebSocketManager: Attempting to reconnect...');
    this.disconnect();
    await this.connect();
  }

  // Getters
  getState(): WebSocketState {
    return { ...this.state };
  }

  getConfig(): WebSocketConfig {
    return { ...this.config };
  }

  getRecentMessages(count = 10): WebSocketMessage[] {
    return this.messageQueue.slice(-count);
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }

  getConnectionStats() {
    return {
      connectionId: this.state.connectionId,
      uptime: this.state.connectionId ? Date.now() - parseInt(this.state.connectionId.split('-')[1]) : 0,
      messagesSent: this.state.messagesSent,
      messagesReceived: this.state.messagesReceived,
      reconnectAttempts: this.state.reconnectAttempts,
      lastHeartbeat: this.state.lastHeartbeat,
      queuedMessages: this.messageQueue.length
    };
  }
}

// Create singleton instance
export const gps51WebSocketManager = new GPS51WebSocketManager();