/**
 * GPS51 Timestamp Utilities
 * 
 * Centralized timestamp handling for GPS51 API responses.
 * GPS51 API returns timestamps in milliseconds - no conversion needed.
 */

export class GPS51TimestampUtils {
  // Year boundaries for timestamp validation
  private static readonly YEAR_2020_MS = 1577836800000; // Jan 1, 2020 in milliseconds
  private static readonly YEAR_2100_MS = 4102444800000; // Jan 1, 2100 in milliseconds

  /**
   * Validate and normalize timestamp from GPS51 API
   * 
   * CRITICAL: GPS51 API already returns timestamps in milliseconds - no conversion needed!
   * This function only validates the timestamp is reasonable.
   * 
   * @param timestamp - Raw timestamp from GPS51 API (already in milliseconds)
   * @returns Validated timestamp in milliseconds
   */
  static validateAndNormalizeTimestamp(timestamp: number): number {
    if (timestamp === 0) return 0;
    
    // GPS51 API already returns timestamps in milliseconds - no conversion needed
    // Just validate it's a reasonable timestamp (after year 2020, before year 2100)
    if (timestamp < this.YEAR_2020_MS || timestamp > this.YEAR_2100_MS) {
      console.warn(`GPS51TimestampUtils: Suspicious timestamp detected: ${timestamp} (${new Date(timestamp).toISOString()})`);
      // Return as-is even if suspicious, but log the warning
    }
    
    return timestamp;
  }

  /**
   * Format relative time for display (e.g., "5m ago", "2h ago")
   */
  static formatRelativeTime(timestamp: number): string {
    if (!timestamp) return 'Never';
    
    const normalizedTimestamp = this.validateAndNormalizeTimestamp(timestamp);
    const now = Date.now();
    const diffMs = now - normalizedTimestamp;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older dates, show formatted date with time
    const date = new Date(normalizedTimestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  /**
   * Format location timestamp for display
   */
  static formatLocationTime(timestamp?: number): string {
    if (!timestamp) return '-';
    
    const normalizedTimestamp = this.validateAndNormalizeTimestamp(timestamp);
    const date = new Date(normalizedTimestamp);
    const now = Date.now();
    const diffMs = now - normalizedTimestamp;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    
    // Show relative time for recent updates
    if (diffMinutes < 60) {
      return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
    }
    
    // Show time for today, date + time for older
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  /**
   * Check if a timestamp represents an "online" device based on activity thresholds
   */
  static isDeviceOnline(lastActiveTime: number, thresholdMinutes: number = 30): boolean {
    if (!lastActiveTime) return false;
    
    const normalizedTimestamp = this.validateAndNormalizeTimestamp(lastActiveTime);
    const now = Date.now();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    
    return (now - normalizedTimestamp) <= thresholdMs;
  }
}