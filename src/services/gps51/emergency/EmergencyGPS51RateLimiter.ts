/**
 * URGENT GPS51 API SPIKE FIXES
 * Emergency Rate Limiter - IMPLEMENT THIS FIRST
 */

interface QueuedRequest {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
}

export class EmergencyGPS51RateLimiter {
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private readonly EMERGENCY_DELAY = 5000; // FIXED: 5 seconds minimum between requests (was 2s)
  private activeRequests = 0;
  private readonly MAX_CONCURRENT = 1; // Only 1 request at a time during emergency
  private rateLimitCount = 0;
  private requestHistory = new Map<string, number>(); // Track request types

  async addRequest<T>(fn: () => Promise<T>, priority: number = 0, requestType?: string): Promise<T> {
    // ENHANCED: Request deduplication to prevent identical simultaneous requests
    if (requestType && this.isDuplicateRequest(requestType)) {
      console.log(`🔄 EmergencyGPS51RateLimiter: Skipping duplicate request: ${requestType}`);
      throw new Error(`Duplicate request blocked: ${requestType}`);
    }

    // ENHANCED: Exponential backoff for rate limit failures
    const backoffDelay = this.calculateBackoffDelay();
    if (backoffDelay > 0) {
      console.log(`⏰ EmergencyGPS51RateLimiter: Applying ${backoffDelay}ms backoff delay`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ fn, resolve, reject, priority });
      this.requestQueue.sort((a, b) => b.priority - a.priority);
      
      if (requestType) {
        this.requestHistory.set(requestType, Date.now());
      }
      
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0 || this.activeRequests >= this.MAX_CONCURRENT) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.MAX_CONCURRENT) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // ENHANCED: Force 5-second delay between ALL requests (was 2s)
      if (timeSinceLastRequest < this.EMERGENCY_DELAY) {
        const waitTime = this.EMERGENCY_DELAY - timeSinceLastRequest;
        console.log(`⏰ EmergencyGPS51RateLimiter: Waiting ${waitTime}ms before next request`);
        await new Promise(resolve => 
          setTimeout(resolve, waitTime)
        );
      }

      const request = this.requestQueue.shift();
      if (!request) break;

      this.lastRequestTime = Date.now();
      this.activeRequests++;

      try {
        const result = await request.fn();
        
        // ENHANCED: Reset rate limit count on successful request
        this.rateLimitCount = 0;
        request.resolve(result);
      } catch (error) {
        // ENHANCED: Detect rate limiting and track failures
        if (this.isRateLimitError(error)) {
          this.rateLimitCount++;
          console.warn(`⚠️ EmergencyGPS51RateLimiter: Rate limit detected (count: ${this.rateLimitCount})`, error.message);
        }
        request.reject(error);
      } finally {
        this.activeRequests--;
      }
    }

    this.isProcessing = false;
    
    // Continue processing if queue not empty
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), this.EMERGENCY_DELAY);
    }
  }

  getQueueSize(): number {
    return this.requestQueue.length;
  }

  clearQueue(): void {
    this.requestQueue.forEach(req => req.reject(new Error('Queue cleared')));
    this.requestQueue = [];
  }

  // ENHANCED: New helper methods for improved rate limiting
  private isDuplicateRequest(requestType: string): boolean {
    const lastRequest = this.requestHistory.get(requestType);
    return lastRequest ? (Date.now() - lastRequest) < 3000 : false; // 3 second deduplication window
  }

  private calculateBackoffDelay(): number {
    if (this.rateLimitCount === 0) return 0;
    // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
    return Math.min(5000 * Math.pow(2, this.rateLimitCount - 1), 60000);
  }

  private isRateLimitError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('too many requests') ||
           errorMessage.includes('8902') ||
           (error?.status && (error.status === 429 || error.status === 8902));
  }

  // ENHANCED: Get diagnostics including rate limit status
  getDiagnostics() {
    return {
      queueSize: this.requestQueue.length,
      activeRequests: this.activeRequests,
      isProcessing: this.isProcessing,
      rateLimitCount: this.rateLimitCount,
      lastRequestTime: this.lastRequestTime,
      emergencyDelay: this.EMERGENCY_DELAY,
      nextAvailableTime: this.lastRequestTime + this.EMERGENCY_DELAY,
      backoffDelay: this.calculateBackoffDelay()
    };
  }
}