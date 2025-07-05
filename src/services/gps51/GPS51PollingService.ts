
export interface PollingOptions {
  pollingInterval?: number;
  maxRetries?: number;
  enableIntelligentPolling?: boolean;
}

export class GPS51PollingService {
  private pollingTimer: NodeJS.Timeout | null = null;
  private options: PollingOptions;
  private retryCount = 0;

  constructor(options: PollingOptions = {}) {
    this.options = {
      pollingInterval: 90000, // EMERGENCY: 90 seconds instead of 30
      maxRetries: 3,
      enableIntelligentPolling: true,
      ...options
    };
  }

  startPolling(callback: () => Promise<void>): void {
    if (this.pollingTimer) {
      console.warn('GPS51PollingService: Polling already active');
      return;
    }

    console.log(`GPS51PollingService: Starting polling every ${this.options.pollingInterval}ms`);

    const poll = async () => {
      try {
        await callback();
        this.retryCount = 0; // Reset retry count on success
      } catch (error) {
        console.error('GPS51PollingService: Polling error:', error);
        
        if (this.retryCount < (this.options.maxRetries || 3)) {
          this.retryCount++;
          console.log(`GPS51PollingService: Retrying... (${this.retryCount}/${this.options.maxRetries})`);
          
          // Exponential backoff
          const delay = 1000 * Math.pow(2, this.retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    // Initial fetch
    poll();

    // Set up recurring polling
    this.pollingTimer = setInterval(poll, this.options.pollingInterval);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('GPS51PollingService: Polling stopped');
    }
  }

  updatePollingInterval(interval: number): void {
    this.options.pollingInterval = interval;
    
    if (this.pollingTimer) {
      this.stopPolling();
      // Restart will happen externally if needed
    }
  }

  isPolling(): boolean {
    return this.pollingTimer !== null;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  resetRetryCount(): void {
    this.retryCount = 0;
  }
}
