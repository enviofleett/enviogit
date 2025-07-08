/**
 * GPS51 Request Coordinator
 * Centralized request management to prevent rate limiting and coordinate API calls
 */

interface RequestQueueItem {
  id: string;
  type: 'login' | 'device_list' | 'positions' | 'tracks' | 'logout';
  priority: number;
  timestamp: number;
  params: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  lastRequestTime: number;
  averageResponseTime: number;
}

export class GPS51RequestCoordinator {
  private static instance: GPS51RequestCoordinator;
  private isActive = false;
  private requestQueue: RequestQueueItem[] = [];
  private requestHistory = new Map<string, number>();
  private stats: RequestStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitedRequests: 0,
    lastRequestTime: 0,
    averageResponseTime: 0
  };

  // Request coordination settings
  private readonly MIN_REQUEST_INTERVAL = 30000; // 30 seconds minimum between position requests
  private readonly BATCH_SIZE = 1; // Process one request at a time
  private readonly DEDUPLICATION_WINDOW = 5000; // 5 seconds

  private constructor() {
    console.log('GPS51RequestCoordinator: Initialized with anti-rate-limiting configuration');
  }

  static getInstance(): GPS51RequestCoordinator {
    if (!GPS51RequestCoordinator.instance) {
      GPS51RequestCoordinator.instance = new GPS51RequestCoordinator();
    }
    return GPS51RequestCoordinator.instance;
  }

  /**
   * Queue a GPS51 API request with intelligent coordination
   */
  async queueRequest<T>(
    type: RequestQueueItem['type'],
    params: any,
    priority: number = 5
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId(type, params);

      // Check for duplicate requests
      if (this.isDuplicateRequest(requestId)) {
        console.log(`🔄 GPS51RequestCoordinator: Blocking duplicate request: ${type}`);
        reject(new Error(`Duplicate request blocked: ${type}`));
        return;
      }

      // Add to queue
      this.requestQueue.push({
        id: requestId,
        type,
        priority,
        timestamp: Date.now(),
        params,
        resolve,
        reject
      });

      // Sort by priority (higher numbers = higher priority)
      this.requestQueue.sort((a, b) => b.priority - a.priority);

      console.log(`📋 GPS51RequestCoordinator: Queued ${type} request (queue size: ${this.requestQueue.length})`);

      // Start processing if not already active
      if (!this.isActive) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the request queue with intelligent timing
   */
  private async processQueue(): Promise<void> {
    if (this.isActive || this.requestQueue.length === 0) {
      return;
    }

    this.isActive = true;
    console.log('🚀 GPS51RequestCoordinator: Starting queue processing');

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      try {
        // Calculate delay based on request type and history
        const delay = this.calculateRequestDelay(request.type);
        
        if (delay > 0) {
          console.log(`⏰ GPS51RequestCoordinator: Waiting ${delay}ms before ${request.type} request`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Execute the request
        const startTime = Date.now();
        const result = await this.executeRequest(request);
        const responseTime = Date.now() - startTime;

        // Update statistics
        this.updateStats(true, responseTime);
        this.requestHistory.set(request.id, Date.now());

        console.log(`✅ GPS51RequestCoordinator: ${request.type} completed in ${responseTime}ms`);
        request.resolve(result);

      } catch (error) {
        const isRateLimit = this.isRateLimitError(error);
        
        if (isRateLimit) {
          this.stats.rateLimitedRequests++;
          console.warn(`⚠️ GPS51RequestCoordinator: Rate limit detected for ${request.type}`);
          
          // Add exponential backoff delay for next request
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second penalty
        }

        this.updateStats(false, 0);
        console.error(`❌ GPS51RequestCoordinator: ${request.type} failed:`, error);
        request.reject(error);
      }
    }

    this.isActive = false;
    console.log('🏁 GPS51RequestCoordinator: Queue processing completed');
  }

  /**
   * Execute a specific request using the emergency client
   */
  private async executeRequest(request: RequestQueueItem): Promise<any> {
    const { EmergencyGPS51Client } = await import('./emergency/EmergencyGPS51Client');
    const client = new EmergencyGPS51Client('https://www.gps51.com:9015/RCSWebAPI/');

    switch (request.type) {
      case 'login':
        return await client.login(request.params.username, request.params.password);

      case 'device_list':
        return await client.getDeviceList(request.params.username, false);

      case 'positions':
        return await client.getLastPosition(
          request.params.deviceIds,
          request.params.lastQueryTime,
          false
        );

      case 'tracks':
        return await client.getHistoryTracks(
          request.params.deviceId,
          request.params.beginTime,
          request.params.endTime,
          request.params.timezone
        );

      case 'logout':
        return await client.logout();

      default:
        throw new Error(`Unknown request type: ${request.type}`);
    }
  }

  /**
   * Calculate intelligent delay between requests
   */
  private calculateRequestDelay(requestType: RequestQueueItem['type']): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.stats.lastRequestTime;

    // High priority requests (login, logout) - minimal delay
    if (requestType === 'login' || requestType === 'logout') {
      return Math.max(0, 2000 - timeSinceLastRequest); // 2 second minimum
    }

    // Device list requests - moderate delay
    if (requestType === 'device_list') {
      return Math.max(0, 10000 - timeSinceLastRequest); // 10 second minimum
    }

    // Position requests - longer delay to prevent rate limiting
    if (requestType === 'positions') {
      return Math.max(0, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }

    // Track requests - moderate delay
    return Math.max(0, 5000 - timeSinceLastRequest); // 5 second minimum
  }

  /**
   * Generate unique request ID for deduplication
   */
  private generateRequestId(type: RequestQueueItem['type'], params: any): string {
    const key = type + JSON.stringify(params);
    return btoa(key).slice(0, 16); // Base64 encoded, truncated
  }

  /**
   * Check if request is duplicate within deduplication window
   */
  private isDuplicateRequest(requestId: string): boolean {
    const lastRequest = this.requestHistory.get(requestId);
    return lastRequest ? (Date.now() - lastRequest) < this.DEDUPLICATION_WINDOW : false;
  }

  /**
   * Detect rate limiting errors
   */
  private isRateLimitError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('too many requests') ||
           errorMessage.includes('8902') ||
           (error?.status && (error.status === 429 || error.status === 8902));
  }

  /**
   * Update request statistics
   */
  private updateStats(success: boolean, responseTime: number): void {
    this.stats.totalRequests++;
    this.stats.lastRequestTime = Date.now();

    if (success) {
      this.stats.successfulRequests++;
      
      // Update average response time
      const totalResponseTime = this.stats.averageResponseTime * (this.stats.successfulRequests - 1);
      this.stats.averageResponseTime = (totalResponseTime + responseTime) / this.stats.successfulRequests;
    } else {
      this.stats.failedRequests++;
    }
  }

  /**
   * Get current statistics and status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      queueSize: this.requestQueue.length,
      stats: { ...this.stats },
      configuration: {
        minRequestInterval: this.MIN_REQUEST_INTERVAL,
        batchSize: this.BATCH_SIZE,
        deduplicationWindow: this.DEDUPLICATION_WINDOW
      },
      nextRequestTime: this.stats.lastRequestTime + this.MIN_REQUEST_INTERVAL
    };
  }

  /**
   * Clear the request queue (emergency use)
   */
  clearQueue(): void {
    this.requestQueue.forEach(req => req.reject(new Error('Queue cleared')));
    this.requestQueue = [];
    console.log('🧹 GPS51RequestCoordinator: Queue cleared');
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      lastRequestTime: 0,
      averageResponseTime: 0
    };
    this.requestHistory.clear();
    console.log('📊 GPS51RequestCoordinator: Statistics reset');
  }
}

// Export singleton instance
export const gps51RequestCoordinator = GPS51RequestCoordinator.getInstance();