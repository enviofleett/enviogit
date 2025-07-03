export interface GPS51Event {
  type: string;
  timestamp: number;
  source: string;
  data: any;
  id: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number; // Time to live in milliseconds
}

export type GPS51EventHandler = (event: GPS51Event) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: GPS51EventHandler;
  options: EventSubscriptionOptions;
  createdAt: number;
  lastTriggered?: number;
  triggerCount: number;
}

export interface EventSubscriptionOptions {
  once?: boolean;
  priority?: 'low' | 'normal' | 'high';
  filter?: (event: GPS51Event) => boolean;
  throttle?: number; // Minimum ms between handler calls
  maxTriggers?: number;
}

export interface EventBusStats {
  totalEvents: number;
  totalSubscriptions: number;
  eventsByType: Record<string, number>;
  subscriptionsByType: Record<string, number>;
  averageProcessingTime: number;
  recentEvents: GPS51Event[];
}

export class GPS51EventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private eventHistory: GPS51Event[] = [];
  private processingQueue: GPS51Event[] = [];
  private isProcessing = false;
  private stats = {
    totalEvents: 0,
    eventsByType: {} as Record<string, number>,
    processingTimes: [] as number[]
  };
  private maxHistorySize = 1000;
  private processingTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Start background processing
    this.startBackgroundProcessing();
  }

  // Event emission
  emit(eventType: string, data: any, options: {
    source?: string;
    priority?: GPS51Event['priority'];
    ttl?: number;
  } = {}): string {
    const event: GPS51Event = {
      type: eventType,
      timestamp: Date.now(),
      source: options.source || 'unknown',
      data,
      id: this.generateEventId(),
      priority: options.priority || 'normal',
      ttl: options.ttl
    };

    // Add to processing queue
    this.queueEvent(event);

    console.log('GPS51EventBus: Event emitted:', {
      type: eventType,
      id: event.id,
      priority: event.priority,
      source: event.source
    });

    return event.id;
  }

  // Event subscription
  on(
    eventType: string, 
    handler: GPS51EventHandler, 
    options: EventSubscriptionOptions = {}
  ): string {
    const subscription: EventSubscription = {
      id: this.generateSubscriptionId(),
      eventType,
      handler,
      options,
      createdAt: Date.now(),
      triggerCount: 0
    };

    this.subscriptions.set(subscription.id, subscription);

    console.log('GPS51EventBus: Subscription created:', {
      id: subscription.id,
      eventType,
      options
    });

    return subscription.id;
  }

  // One-time subscription
  once(eventType: string, handler: GPS51EventHandler): string {
    return this.on(eventType, handler, { once: true });
  }

  // Remove subscription
  off(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    
    if (removed) {
      console.log('GPS51EventBus: Subscription removed:', subscriptionId);
    }
    
    return removed;
  }

  // Remove all subscriptions for an event type
  offAll(eventType: string): number {
    let removedCount = 0;
    
    for (const [id, subscription] of this.subscriptions) {
      if (subscription.eventType === eventType) {
        this.subscriptions.delete(id);
        removedCount++;
      }
    }
    
    console.log(`GPS51EventBus: Removed ${removedCount} subscriptions for event type: ${eventType}`);
    return removedCount;
  }

  // Event processing
  private queueEvent(event: GPS51Event): void {
    // Check TTL
    if (event.ttl && event.timestamp + event.ttl < Date.now()) {
      console.log('GPS51EventBus: Event expired before processing:', event.id);
      return;
    }

    // Insert event based on priority
    this.insertEventByPriority(event);
    
    // Update stats
    this.updateStats(event);
    
    // Add to history
    this.addToHistory(event);
    
    // Process immediately if high/critical priority
    if (event.priority === 'high' || event.priority === 'critical') {
      this.processQueueImmediate();
    }
  }

  private insertEventByPriority(event: GPS51Event): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const eventPriority = priorityOrder[event.priority];
    
    let insertIndex = this.processingQueue.length;
    
    // Find correct insertion point based on priority
    for (let i = 0; i < this.processingQueue.length; i++) {
      const queuedPriority = priorityOrder[this.processingQueue[i].priority];
      if (eventPriority < queuedPriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.processingQueue.splice(insertIndex, 0, event);
  }

  private async processQueueImmediate(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      await this.processNextEvent();
    } finally {
      this.isProcessing = false;
    }
  }

  private startBackgroundProcessing(): void {
    if (this.processingTimer) return;
    
    this.processingTimer = setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processQueueImmediate();
      }
    }, 100); // Process every 100ms
  }

  private async processNextEvent(): Promise<void> {
    const event = this.processingQueue.shift();
    if (!event) return;

    const startTime = Date.now();
    
    try {
      // Check TTL again
      if (event.ttl && event.timestamp + event.ttl < Date.now()) {
        console.log('GPS51EventBus: Event expired during processing:', event.id);
        return;
      }

      const matchingSubscriptions = this.getMatchingSubscriptions(event);
      
      // Process subscriptions in parallel for better performance
      const processingPromises = matchingSubscriptions.map(async (subscription) => {
        try {
          await this.processSubscription(subscription, event);
        } catch (error) {
          console.error('GPS51EventBus: Subscription handler error:', {
            subscriptionId: subscription.id,
            eventType: event.type,
            error: error instanceof Error ? error.message : error
          });
        }
      });

      await Promise.all(processingPromises);
      
    } catch (error) {
      console.error('GPS51EventBus: Event processing error:', {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : error
      });
    } finally {
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);
      
      console.log('GPS51EventBus: Event processed:', {
        eventId: event.id,
        eventType: event.type,
        processingTime,
        subscriptionsTriggered: this.getMatchingSubscriptions(event).length
      });
    }
  }

  private getMatchingSubscriptions(event: GPS51Event): EventSubscription[] {
    const matches: EventSubscription[] = [];
    
    for (const subscription of this.subscriptions.values()) {
      // Check event type match (support wildcards)
      if (!this.eventTypeMatches(subscription.eventType, event.type)) {
        continue;
      }
      
      // Check custom filter
      if (subscription.options.filter && !subscription.options.filter(event)) {
        continue;
      }
      
      // Check throttling
      if (subscription.options.throttle && subscription.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - subscription.lastTriggered;
        if (timeSinceLastTrigger < subscription.options.throttle) {
          continue;
        }
      }
      
      // Check max triggers
      if (subscription.options.maxTriggers && subscription.triggerCount >= subscription.options.maxTriggers) {
        // Remove subscription that has reached max triggers
        this.subscriptions.delete(subscription.id);
        continue;
      }
      
      matches.push(subscription);
    }
    
    // Sort by priority
    return matches.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const aPriority = priorityOrder[a.options.priority || 'normal'];
      const bPriority = priorityOrder[b.options.priority || 'normal'];
      return aPriority - bPriority;
    });
  }

  private eventTypeMatches(subscriptionType: string, eventType: string): boolean {
    // Exact match
    if (subscriptionType === eventType) return true;
    
    // Wildcard support
    if (subscriptionType === '*') return true;
    
    // Prefix wildcard (e.g., "gps51.*" matches "gps51.position.update")
    if (subscriptionType.endsWith('*')) {
      const prefix = subscriptionType.slice(0, -1);
      return eventType.startsWith(prefix);
    }
    
    // Suffix wildcard (e.g., "*.update" matches "gps51.position.update")
    if (subscriptionType.startsWith('*')) {
      const suffix = subscriptionType.slice(1);
      return eventType.endsWith(suffix);
    }
    
    return false;
  }

  private async processSubscription(subscription: EventSubscription, event: GPS51Event): Promise<void> {
    try {
      // Update subscription stats
      subscription.lastTriggered = Date.now();
      subscription.triggerCount++;
      
      // Call handler
      await subscription.handler(event);
      
      // Remove one-time subscriptions
      if (subscription.options.once) {
        this.subscriptions.delete(subscription.id);
      }
      
    } catch (error) {
      console.error('GPS51EventBus: Subscription handler failed:', {
        subscriptionId: subscription.id,
        eventType: event.type,
        error
      });
      throw error;
    }
  }

  // Utility methods
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateStats(event: GPS51Event): void {
    this.stats.totalEvents++;
    this.stats.eventsByType[event.type] = (this.stats.eventsByType[event.type] || 0) + 1;
  }

  private recordProcessingTime(time: number): void {
    this.stats.processingTimes.push(time);
    
    // Keep only recent processing times
    if (this.stats.processingTimes.length > 100) {
      this.stats.processingTimes.shift();
    }
  }

  private addToHistory(event: GPS51Event): void {
    this.eventHistory.push(event);
    
    // Maintain history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  // Public API methods
  getStats(): EventBusStats {
    const subscriptionsByType: Record<string, number> = {};
    
    for (const subscription of this.subscriptions.values()) {
      subscriptionsByType[subscription.eventType] = (subscriptionsByType[subscription.eventType] || 0) + 1;
    }
    
    const averageProcessingTime = this.stats.processingTimes.length > 0
      ? this.stats.processingTimes.reduce((sum, time) => sum + time, 0) / this.stats.processingTimes.length
      : 0;
    
    return {
      totalEvents: this.stats.totalEvents,
      totalSubscriptions: this.subscriptions.size,
      eventsByType: { ...this.stats.eventsByType },
      subscriptionsByType,
      averageProcessingTime: Math.round(averageProcessingTime),
      recentEvents: this.eventHistory.slice(-10)
    };
  }

  getEventHistory(eventType?: string, limit = 50): GPS51Event[] {
    let events = this.eventHistory;
    
    if (eventType) {
      events = events.filter(event => this.eventTypeMatches(eventType, event.type));
    }
    
    return events.slice(-limit);
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  clearHistory(): void {
    this.eventHistory = [];
    console.log('GPS51EventBus: Event history cleared');
  }

  clearSubscriptions(): void {
    this.subscriptions.clear();
    console.log('GPS51EventBus: All subscriptions cleared');
  }

  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    
    this.clearSubscriptions();
    this.clearHistory();
    this.processingQueue = [];
    
    console.log('GPS51EventBus: Destroyed');
  }
}

// Create singleton instance
export const gps51EventBus = new GPS51EventBus();
