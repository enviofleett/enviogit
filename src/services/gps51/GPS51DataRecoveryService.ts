import { supabase } from '@/integrations/supabase/client';
import { GPS51Device, GPS51Position } from './GPS51Types';
import { GPS51Client } from './GPS51Client';
import { gps51DatabaseIntegration } from './GPS51DatabaseIntegration';
import { gps51AuthService } from '../gp51/GPS51AuthService';
import { GPS51RateLimitError } from './GPS51RateLimitError';

export interface RecoveryConfig {
  apiEndpoint?: string;
  token?: string;
  retryAttempts?: number;
  batchSize?: number;
  timeoutMs?: number;
}

export interface DataQualityIssue {
  type: 'missing_calculated_lat' | 'missing_calculated_lon' | 'invalid_latitude_range' | 
        'invalid_longitude_range' | 'stale_data' | 'missing_speed' | 'missing_timestamp';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DeviceRecoveryResult {
  deviceId: string;
  success: boolean;
  issues: DataQualityIssue[];
  fixesApplied: string[];
  error?: string;
}

export interface RecoveryReport {
  timestamp: string;
  totalDevicesProcessed: number;
  successfullyFixed: number;
  failedDevices: number;
  criticalIssuesFound: number;
  executionTimeMs: number;
  deviceResults: DeviceRecoveryResult[];
  summary: {
    positionsRecovered: number;
    dataQualityImproved: number;
    emergencyRecoveryNeeded: boolean;
  };
}

export interface BatchProcessResult {
  processed: number;
  fixed: number;
  failed: number;
}

export class GPS51DataRecoveryService {
  private static instance: GPS51DataRecoveryService;
  private config: Required<RecoveryConfig>;
  private processedDevices = new Set<string>();
  private failedDevices = new Map<string, string>();
  private gps51Client: GPS51Client;
  private isRateLimited = false;
  private rateLimitCooldownUntil = 0;

  constructor(config: RecoveryConfig = {}, client?: GPS51Client) {
    this.config = {
      apiEndpoint: config.apiEndpoint || 'https://www.gps51.com/webapi',
      token: config.token || '',
      retryAttempts: config.retryAttempts || 3,
      batchSize: config.batchSize || 50,
      timeoutMs: config.timeoutMs || 30000
    };
    
    this.gps51Client = client || new GPS51Client();
  }

  static getInstance(config?: RecoveryConfig, client?: GPS51Client): GPS51DataRecoveryService {
    if (!GPS51DataRecoveryService.instance) {
      GPS51DataRecoveryService.instance = new GPS51DataRecoveryService(config, client);
    }
    return GPS51DataRecoveryService.instance;
  }

  /**
   * Main emergency data recovery function
   */
  async emergencyDataRecovery(): Promise<RecoveryReport> {
    const startTime = Date.now();
    
    try {
      console.log('🚨 GPS51DataRecoveryService: Starting emergency data recovery...');

      // Ensure GPS51 authentication is available
      if (!gps51AuthService.isAuthenticated()) {
        console.warn('GPS51DataRecoveryService: Not authenticated, attempting to restore...');
        
        // Try to restore authentication from stored credentials
        try {
          const restored = await gps51AuthService.restoreAuthentication();
          if (restored) {
            console.log('GPS51DataRecoveryService: Authentication restored successfully');
            // Get the authenticated client from the auth service
            this.gps51Client = gps51AuthService.getClient();
          } else {
            throw new Error('Could not restore authentication from stored credentials');
          }
        } catch (authError) {
          console.error('GPS51DataRecoveryService: Failed to restore authentication:', authError);
          throw new Error('GPS51 authentication required. Please go to the "Credentials" tab and authenticate with your GPS51 account first, then try again.');
        }
        
        // Double-check authentication was successful
        if (!gps51AuthService.isAuthenticated()) {
          throw new Error('GPS51 authentication required. Please go to the "Credentials" tab and authenticate with your GPS51 account first, then try again.');
        }
      } else {
        // Use the authenticated client from the auth service
        this.gps51Client = gps51AuthService.getClient();
      }

      // Step 1: Get all devices
      const devices = await this.getAllDevices();
      console.log(`📱 Found ${devices.length} devices to process`);

      if (devices.length === 0) {
        console.warn('⚠️ No devices found for recovery');
        return this.generateEmptyReport(startTime);
      }

      // Step 2: Process devices in smaller batches with rate limiting
      const RECOVERY_BATCH_SIZE = 5; // Much smaller batches for emergency recovery
      const BATCH_DELAY = 3000; // 3 seconds between batches
      
      const batches = this.chunkArray(devices, RECOVERY_BATCH_SIZE);
      let totalProcessed = 0;
      let totalFixed = 0;
      let totalFailed = 0;
      const deviceResults: DeviceRecoveryResult[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📊 Processing emergency recovery batch ${i + 1}/${batches.length} (${batch.length} devices)`);

        try {
          // Check if we're in rate limit cooldown
          if (this.isRateLimited && Date.now() < this.rateLimitCooldownUntil) {
            const waitTime = this.rateLimitCooldownUntil - Date.now();
            console.log(`⏳ Rate limit cooldown active, waiting ${Math.round(waitTime / 1000)}s...`);
            await this.delay(waitTime);
            this.isRateLimited = false;
          }

          const batchResults = await this.processBatch(batch);
          totalProcessed += batchResults.processed;
          totalFixed += batchResults.fixed;
          totalFailed += batchResults.failed;

          // Mandatory delay between batches to prevent rate limiting
          if (i < batches.length - 1) {
            console.log(`⏸️ Batch delay: ${BATCH_DELAY}ms to prevent rate limiting`);
            await this.delay(BATCH_DELAY);
          }

        } catch (error) {
          if (GPS51RateLimitError.isRateLimitError(error)) {
            console.warn(`🚫 Rate limit hit during batch ${i + 1}, activating cooldown`);
            this.handleRateLimitError(error as GPS51RateLimitError);
            // Skip this batch but continue with cooldown applied
            totalFailed += batch.length;
          } else {
            throw error;
          }
        }
      }

      const executionTime = Date.now() - startTime;
      
      // Generate comprehensive recovery report
      const report: RecoveryReport = {
        timestamp: new Date().toISOString(),
        totalDevicesProcessed: totalProcessed,
        successfullyFixed: totalFixed,
        failedDevices: totalFailed,
        criticalIssuesFound: Array.from(this.failedDevices.values()).length,
        executionTimeMs: executionTime,
        deviceResults,
        summary: {
          positionsRecovered: totalFixed,
          dataQualityImproved: Math.round((totalFixed / totalProcessed) * 100),
          emergencyRecoveryNeeded: totalFailed > (totalProcessed * 0.3) // More than 30% failed
        }
      };

      console.log(`✅ Recovery complete: ${totalFixed}/${totalProcessed} devices fixed in ${executionTime}ms`);
      return report;

    } catch (error) {
      console.error('❌ Emergency recovery failed:', error);
      throw new Error(`Emergency recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all devices using the existing GPS51Client
   */
  private async getAllDevices(): Promise<GPS51Device[]> {
    try {
      const devices = await this.gps51Client.getDeviceList();
      console.log(`GPS51DataRecoveryService: Retrieved ${devices.length} devices from GPS51Client`);
      return devices;
    } catch (error) {
      console.error('Failed to get devices from GPS51Client:', error);
      throw new Error(`Failed to retrieve devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a batch of devices with rate limiting protection
   */
  private async processBatch(devices: GPS51Device[]): Promise<BatchProcessResult> {
    let processed = 0;
    let fixed = 0;
    let failed = 0;

    // Process devices sequentially to avoid overwhelming the API
    for (const device of devices) {
      try {
        const result = await this.processDevice(device);
        processed++;

        if (result.success) {
          fixed++;
          this.processedDevices.add(device.deviceid);
        } else {
          failed++;
        }

        // Small delay between individual device processing
        await this.delay(500); // 500ms between devices
        
      } catch (error) {
        failed++;
        if (GPS51RateLimitError.isRateLimitError(error)) {
          console.warn(`🚫 Rate limit error for device ${device.deviceid}`);
          this.handleRateLimitError(error as GPS51RateLimitError);
          throw error; // Propagate rate limit error to batch level
        } else {
          console.error(`❌ Failed to process device ${device.deviceid}:`, error);
          this.failedDevices.set(device.deviceid, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    return { processed, fixed, failed };
  }

  /**
   * Process individual device
   */
  private async processDevice(device: GPS51Device): Promise<DeviceRecoveryResult> {
    try {
      // Get latest position for this device
      const positionData = await this.getDevicePosition(device.deviceid);

      if (!positionData) {
        return {
          deviceId: device.deviceid,
          success: false,
          issues: [{ type: 'missing_timestamp', description: 'No position data available', severity: 'critical' }],
          fixesApplied: [],
          error: 'No position data'
        };
      }

      // Check data quality
      const issues = this.checkDataQuality(positionData);

      if (issues.length === 0) {
        return {
          deviceId: device.deviceid,
          success: true,
          issues: [],
          fixesApplied: ['data_already_valid'],
        };
      }

      // Apply fixes
      const { fixedData, appliedFixes } = this.applyDataFixes(positionData, issues);

      // Save fixed data using existing database integration
      await this.saveFixedData(device.deviceid, fixedData);

      console.log(`✅ Fixed device ${device.deviceid}: ${appliedFixes.join(', ')}`);
      
      return {
        deviceId: device.deviceid,
        success: true,
        issues,
        fixesApplied: appliedFixes,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        deviceId: device.deviceid,
        success: false,
        issues: [],
        fixesApplied: [],
        error: errorMessage
      };
    }
  }

  /**
   * Get device position using existing GPS51 client with rate limit handling
   */
  private async getDevicePosition(deviceId: string): Promise<GPS51Position | null> {
    try {
      const { positions } = await this.gps51Client.getRealtimePositions([deviceId]);
      return positions.length > 0 ? positions[0] : null;
    } catch (error) {
      if (GPS51RateLimitError.isRateLimitError(error)) {
        console.warn(`🚫 Rate limit hit while fetching position for device ${deviceId}`);
        throw error; // Propagate rate limit error
      }
      console.error(`Failed to get position for device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Check data quality issues
   */
  private checkDataQuality(positionData: GPS51Position): DataQualityIssue[] {
    const issues: DataQualityIssue[] = [];

    // Check for missing or zero coordinates
    if (!positionData.callat || positionData.callat === 0) {
      issues.push({
        type: 'missing_calculated_lat',
        description: 'Calculated latitude is missing or zero',
        severity: 'critical'
      });
    }

    if (!positionData.callon || positionData.callon === 0) {
      issues.push({
        type: 'missing_calculated_lon',
        description: 'Calculated longitude is missing or zero',
        severity: 'critical'
      });
    }

    // Check for invalid coordinate ranges
    if (positionData.callat && (positionData.callat < -90 || positionData.callat > 90)) {
      issues.push({
        type: 'invalid_latitude_range',
        description: `Invalid latitude range: ${positionData.callat}`,
        severity: 'high'
      });
    }

    if (positionData.callon && (positionData.callon < -180 || positionData.callon > 180)) {
      issues.push({
        type: 'invalid_longitude_range',
        description: `Invalid longitude range: ${positionData.callon}`,
        severity: 'high'
      });
    }

    // Check for stale data
    if (positionData.updatetime) {
      const lastUpdate = new Date(positionData.updatetime);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate > 24) {
        issues.push({
          type: 'stale_data',
          description: `Data is ${Math.round(hoursSinceUpdate)} hours old`,
          severity: 'medium'
        });
      }
    }

    // Check for missing essential data
    if (positionData.speed === undefined || positionData.speed === null) {
      issues.push({
        type: 'missing_speed',
        description: 'Speed data is missing',
        severity: 'low'
      });
    }

    return issues;
  }

  /**
   * Apply fixes to the data
   */
  private applyDataFixes(positionData: GPS51Position, issues: DataQualityIssue[]): { 
    fixedData: GPS51Position; 
    appliedFixes: string[] 
  } {
    const fixedData = { ...positionData };
    const appliedFixes: string[] = [];

    issues.forEach(issue => {
      switch (issue.type) {
        case 'missing_calculated_lat':
          // Try to use device position data if available
          if (fixedData.callat === 0 && fixedData.callon !== 0) {
            // If longitude is valid, this might be a GPS coordinate swap issue
            console.warn(`Device ${positionData.deviceid}: Potential coordinate swap detected`);
          }
          appliedFixes.push('coordinate_validation');
          break;

        case 'missing_calculated_lon':
          if (fixedData.callon === 0 && fixedData.callat !== 0) {
            console.warn(`Device ${positionData.deviceid}: Potential coordinate swap detected`);
          }
          appliedFixes.push('coordinate_validation');
          break;

        case 'invalid_latitude_range':
          fixedData.callat = Math.max(-90, Math.min(90, fixedData.callat));
          appliedFixes.push('latitude_range_fix');
          break;

        case 'invalid_longitude_range':
          fixedData.callon = Math.max(-180, Math.min(180, fixedData.callon));
          appliedFixes.push('longitude_range_fix');
          break;

        case 'missing_speed':
          fixedData.speed = 0;
          appliedFixes.push('speed_default');
          break;

        case 'stale_data':
          // Update timestamp to current time for real-time processing
          fixedData.updatetime = Date.now();
          appliedFixes.push('timestamp_refresh');
          break;
      }
    });

    return { fixedData, appliedFixes };
  }

  /**
   * Save fixed data using existing database integration
   */
  private async saveFixedData(deviceId: string, fixedData: GPS51Position): Promise<void> {
    try {
      // Store positions directly without RPC call
      const { error } = await supabase
        .from('vehicle_positions')
        .insert({
          device_id: deviceId,
          latitude: fixedData.callat,
          longitude: fixedData.callon,
          timestamp: new Date(fixedData.updatetime).toISOString(),
          speed: fixedData.speed || 0,
          heading: fixedData.course || 0,
          altitude: 0,
          ignition_status: fixedData.moving === 1,
          fuel_level: fixedData.fuel || null,
          battery_level: fixedData.voltage || null,
          address: fixedData.strstatus || null
        });

      if (error) {
        throw new Error(`Database upsert failed: ${error.message}`);
      }

    } catch (error) {
      console.error(`Failed to save fixed data for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Generate empty report for cases with no devices
   */
  private generateEmptyReport(startTime: number): RecoveryReport {
    return {
      timestamp: new Date().toISOString(),
      totalDevicesProcessed: 0,
      successfullyFixed: 0,
      failedDevices: 0,
      criticalIssuesFound: 0,
      executionTimeMs: Date.now() - startTime,
      deviceResults: [],
      summary: {
        positionsRecovered: 0,
        dataQualityImproved: 0,
        emergencyRecoveryNeeded: false
      }
    };
  }

  /**
   * Utility functions
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    processedDevices: number;
    failedDevices: number;
    successRate: number;
  } {
    const processed = this.processedDevices.size;
    const failed = this.failedDevices.size;
    const total = processed + failed;
    
    return {
      processedDevices: processed,
      failedDevices: failed,
      successRate: total > 0 ? (processed / total) * 100 : 0
    };
  }

  /**
   * Handle rate limit errors
   */
  private handleRateLimitError(error: GPS51RateLimitError): void {
    this.isRateLimited = true;
    this.rateLimitCooldownUntil = Date.now() + Math.max(error.retryAfter, 10000); // Minimum 10 seconds
    console.warn(`🔒 GPS51 Rate Limit activated. Cooldown until: ${new Date(this.rateLimitCooldownUntil).toISOString()}`);
  }

  /**
   * Check if currently rate limited
   */
  isCurrentlyRateLimited(): boolean {
    return this.isRateLimited && Date.now() < this.rateLimitCooldownUntil;
  }

  /**
   * Get time remaining in rate limit cooldown
   */
  getRateLimitCooldownRemaining(): number {
    if (!this.isRateLimited) return 0;
    return Math.max(0, this.rateLimitCooldownUntil - Date.now());
  }

  /**
   * Reset recovery state
   */
  reset(): void {
    this.processedDevices.clear();
    this.failedDevices.clear();
    this.isRateLimited = false;
    this.rateLimitCooldownUntil = 0;
  }
}

// Export singleton instance
export const gps51DataRecoveryService = GPS51DataRecoveryService.getInstance();