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
  private readonly EMERGENCY_DELAY = 2000; // 2 seconds minimum between requests
  private activeRequests = 0;
  private readonly MAX_CONCURRENT = 1; // Only 1 request at a time during emergency

  async addRequest<T>(fn: () => Promise<T>, priority: number = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ fn, resolve, reject, priority });
      this.requestQueue.sort((a, b) => b.priority - a.priority);
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

      // FORCE 2-second delay between ALL requests
      if (timeSinceLastRequest < this.EMERGENCY_DELAY) {
        await new Promise(resolve => 
          setTimeout(resolve, this.EMERGENCY_DELAY - timeSinceLastRequest)
        );
      }

      const request = this.requestQueue.shift();
      if (!request) break;

      this.lastRequestTime = Date.now();
      this.activeRequests++;

      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
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
}