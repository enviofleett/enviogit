/**
 * GPS51TimeManager - Handles UTC time synchronization for GPS51 API
 * Converts between WAT (GMT+1) and UTC for accurate API communication
 */
export class GPS51TimeManager {
  private static readonly WAT_OFFSET_HOURS = 1; // West Africa Time is GMT+1
  private static readonly GPS51_DEFAULT_TIMEZONE = 8; // GPS51 default is GMT+8

  /**
   * Convert local WAT time to UTC timestamp for API calls
   */
  static watToUtcTimestamp(watDate?: Date): number {
    const date = watDate || new Date();
    // Convert WAT to UTC by subtracting 1 hour
    const utcTime = date.getTime() - (this.WAT_OFFSET_HOURS * 60 * 60 * 1000);
    return utcTime; // Return as milliseconds timestamp
  }

  /**
   * Convert UTC timestamp from server to WAT for display
   */
  static utcTimestampToWat(utcTimestamp: number): Date {
    // Assume timestamp is in milliseconds and add WAT offset
    const watMs = utcTimestamp + (this.WAT_OFFSET_HOURS * 60 * 60 * 1000);
    return new Date(watMs);
  }

  /**
   * Get current UTC timestamp for lastquerypositiontime parameter (in milliseconds)
   */
  static getCurrentUtcTimestamp(): number {
    return Date.now(); // Return milliseconds, not seconds
  }

  /**
   * Format UTC timestamp for GPS51 API parameters
   */
  static formatForApi(timestamp: number): string {
    return Math.floor(timestamp).toString(); // Ensure integer for API
  }

  /**
   * Validate if timestamp is recent (within expected range) - all timestamps in milliseconds
   */
  static isRecentTimestamp(timestamp: number, maxAgeMinutes: number = 30): boolean {
    const currentUtc = this.getCurrentUtcTimestamp();
    const ageMs = currentUtc - timestamp; // Both in milliseconds
    const maxAgeMs = maxAgeMinutes * 60 * 1000; // Convert minutes to milliseconds
    return ageMs <= maxAgeMs;
  }

  /**
   * Calculate time difference between server and client
   */
  static calculateServerTimeDrift(serverTimestamp: number): number {
    const clientUtc = this.getCurrentUtcTimestamp();
    return serverTimestamp - clientUtc; // Positive means server is ahead
  }

  /**
   * Get properly formatted time range for historical queries
   */
  static getTimeRange(startWat: Date, endWat: Date): {
    begintime: string;
    endtime: string;
    timezone: number;
  } {
    return {
      begintime: this.formatForApi(this.watToUtcTimestamp(startWat)),
      endtime: this.formatForApi(this.watToUtcTimestamp(endWat)),
      timezone: this.GPS51_DEFAULT_TIMEZONE
    };
  }

  /**
   * Log time synchronization info for debugging
   */
  static logTimeSyncInfo(label: string, serverTimestamp?: number): void {
    const clientUtc = this.getCurrentUtcTimestamp();
    const clientWat = new Date();
    
    console.log(`GPS51TimeManager [${label}]:`, {
      clientUtcTimestamp: clientUtc,
      clientWatTime: clientWat.toISOString(),
      serverUtcTimestamp: serverTimestamp,
      serverWatTime: serverTimestamp ? this.utcTimestampToWat(serverTimestamp).toISOString() : 'N/A',
      timeDrift: serverTimestamp ? this.calculateServerTimeDrift(serverTimestamp) : 'N/A'
    });
  }
}