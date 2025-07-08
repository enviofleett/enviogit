/**
 * GPS51 WebSocket Manager
 * Handles WebSocket connections and cleanup for GPS51 services
 * IMPORTANT: GPS51 API uses polling, not WebSockets for live data
 */

export class GPS51WebSocketManager {
  private static instance: GPS51WebSocketManager;
  private connections = new Map<string, WebSocket>();
  private isWebSocketSupported = false;

  private constructor() {
    this.checkWebSocketSupport();
  }

  static getInstance(): GPS51WebSocketManager {
    if (!GPS51WebSocketManager.instance) {
      GPS51WebSocketManager.instance = new GPS51WebSocketManager();
    }
    return GPS51WebSocketManager.instance;
  }

  /**
   * Check if WebSocket is supported and GPS51 API provides WebSocket endpoints
   */
  private checkWebSocketSupport(): void {
    // CRITICAL: GPS51 API documentation indicates POLLING-BASED API only
    // WebSocket connections to localhost are failing and not needed
    this.isWebSocketSupported = false;
    
    console.log('📡 GPS51WebSocketManager: WebSocket support disabled - GPS51 API uses polling model');
    console.log('📡 GPS51WebSocketManager: Localhost WebSocket connections will be prevented');
  }

  /**
   * Prevent WebSocket connections (GPS51 uses polling)
   */
  createConnection(url: string, protocols?: string[]): WebSocket | null {
    console.warn('⚠️ GPS51WebSocketManager: WebSocket connection prevented - GPS51 API uses polling');
    console.warn('⚠️ GPS51WebSocketManager: Use GPS51UnifiedLiveDataService for live data instead');
    
    // Return null to prevent connection attempts
    return null;
  }

  /**
   * Cleanup any existing WebSocket connections
   */
  closeAllConnections(): void {
    console.log('🧹 GPS51WebSocketManager: Closing all WebSocket connections');
    
    this.connections.forEach((socket, id) => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'GPS51 uses polling - WebSocket not needed');
      }
    });
    
    this.connections.clear();
    console.log('🧹 GPS51WebSocketManager: All WebSocket connections closed');
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isWebSocketSupported: this.isWebSocketSupported,
      activeConnections: this.connections.size,
      connectionIds: Array.from(this.connections.keys()),
      recommendation: 'Use GPS51UnifiedLiveDataService.fetchLivePositions() for live data'
    };
  }

  /**
   * Disable WebSocket creation globally (for debugging)
   */
  disableWebSockets(): void {
    // Override WebSocket constructor to prevent connections
    if (typeof window !== 'undefined' && window.WebSocket) {
      const originalWebSocket = window.WebSocket;
      
      window.WebSocket = class extends EventTarget {
        constructor(url: string, protocols?: string | string[]) {
          super();
          console.warn('🚫 GPS51WebSocketManager: WebSocket creation blocked:', url);
          console.warn('🚫 GPS51WebSocketManager: Use GPS51 polling API instead');
          
          // Simulate immediate close
          setTimeout(() => {
            const event = new Event('close');
            this.dispatchEvent(event);
          }, 100);
        }
        
        close() {
          console.log('🔌 GPS51WebSocketManager: WebSocket close called (was prevented)');
        }
        
        send() {
          console.warn('🚫 GPS51WebSocketManager: WebSocket send blocked - use GPS51 API');
        }
        
        get readyState() { return WebSocket.CLOSED; }
        get url() { return ''; }
        get protocol() { return ''; }
        get bufferedAmount() { return 0; }
        get extensions() { return ''; }
        get binaryType() { return 'blob'; }
        
        static get CONNECTING() { return 0; }
        static get OPEN() { return 1; }
        static get CLOSING() { return 2; }
        static get CLOSED() { return 3; }
      } as any;
      
      console.log('🚫 GPS51WebSocketManager: WebSocket constructor overridden to prevent connections');
    }
  }

  /**
   * Re-enable WebSocket creation (restore original)
   */
  enableWebSockets(): void {
    if (typeof window !== 'undefined') {
      // This would need a reference to original WebSocket
      console.log('🔌 GPS51WebSocketManager: WebSocket re-enablement not implemented');
      console.log('🔌 GPS51WebSocketManager: Refresh page to restore WebSocket functionality');
    }
  }
}

// Export singleton instance
export const gps51WebSocketManager = GPS51WebSocketManager.getInstance();

// Automatically disable problematic WebSocket connections
if (typeof window !== 'undefined') {
  // Prevent localhost WebSocket connections that are failing
  gps51WebSocketManager.disableWebSockets();
}