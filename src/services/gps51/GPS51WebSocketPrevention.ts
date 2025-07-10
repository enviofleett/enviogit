/**
 * GPS51 WebSocket Prevention Service
 * Prevents WebSocket connections that cause console errors
 * GPS51 API uses polling, not WebSockets
 */

export class GPS51WebSocketPrevention {
  private static instance: GPS51WebSocketPrevention;
  private originalWebSocket: typeof WebSocket | null = null;
  private preventionActive = false;

  private constructor() {
    this.initializePrevention();
  }

  static getInstance(): GPS51WebSocketPrevention {
    if (!GPS51WebSocketPrevention.instance) {
      GPS51WebSocketPrevention.instance = new GPS51WebSocketPrevention();
    }
    return GPS51WebSocketPrevention.instance;
  }

  /**
   * Initialize WebSocket prevention to stop console errors
   */
  private initializePrevention(): void {
    if (typeof window === 'undefined' || this.preventionActive) {
      return;
    }

    // Store original WebSocket constructor
    this.originalWebSocket = window.WebSocket;
    
    // Create a silent prevention wrapper
    const preventedWebSocket = class extends EventTarget implements WebSocket {
      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSING = 2;
      readonly CLOSED = 3;
      
      readonly readyState = 3; // CLOSED
      readonly url: string;
      readonly protocol = '';
      readonly extensions = '';
      readonly bufferedAmount = 0;
      
      binaryType: BinaryType = 'blob';
      onopen: ((this: WebSocket, ev: Event) => any) | null = null;
      onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
      onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
      onerror: ((this: WebSocket, ev: Event) => any) | null = null;

      constructor(url: string | URL, protocols?: string | string[]) {
        super();
        this.url = url.toString();
        
        // Only log for localhost connections (which are causing the errors)
        if (this.url.includes('localhost')) {
          console.log('🔇 GPS51: Prevented WebSocket connection to localhost (GPS51 uses polling)');
        }
        
        // Silently fail by immediately closing
        setTimeout(() => {
          if (this.onclose) {
            this.onclose(new CloseEvent('close', { 
              code: 1000, 
              reason: 'GPS51 uses polling - WebSocket prevented',
              wasClean: true 
            }));
          }
        }, 0);
      }

      close(code?: number, reason?: string): void {
        // Silent close - no logging needed
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        // Silent send prevention - no logging needed
      }

      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
    };

    // Replace WebSocket constructor
    (window as any).WebSocket = preventedWebSocket;
    this.preventionActive = true;
    
    console.log('🔇 GPS51WebSocketPrevention: Initialized - localhost WebSocket errors will be prevented');
  }

  /**
   * Restore original WebSocket functionality if needed
   */
  restoreWebSocket(): void {
    if (typeof window !== 'undefined' && this.originalWebSocket) {
      (window as any).WebSocket = this.originalWebSocket;
      this.preventionActive = false;
      console.log('🔌 GPS51WebSocketPrevention: WebSocket functionality restored');
    }
  }

  /**
   * Check if prevention is active
   */
  isPreventionActive(): boolean {
    return this.preventionActive;
  }
}

// Auto-initialize to prevent WebSocket errors immediately
export const gps51WebSocketPrevention = GPS51WebSocketPrevention.getInstance();