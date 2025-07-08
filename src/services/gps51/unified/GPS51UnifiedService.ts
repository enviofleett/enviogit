/**
 * GPS51 Unified Service - PRODUCTION READY
 * Single source of truth for all GPS51 authentication and data operations
 * Phase 1: Emergency Authentication Consolidation - CRITICAL
 */

import { GPS51AuthManager, GPS51AuthState } from './GPS51AuthManager';
import { GPS51DeviceManager } from './GPS51DeviceManager';
import { GPS51PositionManager } from './GPS51PositionManager';
import { GPS51PollingManager } from './GPS51PollingManager';
import { GPS51Vehicle, GPS51Position, LiveDataResult } from '../GPS51UnifiedLiveDataService';
import { GPS51ConfigStorage } from '../configStorage';

export class GPS51UnifiedService {
  private static instance: GPS51UnifiedService;
  
  private authManager: GPS51AuthManager;
  private deviceManager: GPS51DeviceManager;
  private positionManager: GPS51PositionManager;
  private pollingManager: GPS51PollingManager;
  
  private readonly apiUrl: string;

  private constructor(apiUrl: string = 'https://api.gps51.com/openapi') {
    this.apiUrl = apiUrl;
    
    // Initialize managers
    this.authManager = new GPS51AuthManager(apiUrl);
    this.deviceManager = new GPS51DeviceManager(apiUrl);
    this.positionManager = new GPS51PositionManager(apiUrl);
    this.pollingManager = new GPS51PollingManager();
    
    console.log('GPS51UnifiedService: Initialized with modular architecture');
  }

  static getInstance(): GPS51UnifiedService {
    if (!GPS51UnifiedService.instance) {
      GPS51UnifiedService.instance = new GPS51UnifiedService();
    }
    return GPS51UnifiedService.instance;
  }

  /**
   * Authenticate user - PRODUCTION FIX: Save credentials to storage
   */
  async authenticate(username: string, password: string): Promise<GPS51AuthState> {
    // CRITICAL: Save credentials first for persistence
    const { GPS51ConfigStorage } = await import('../configStorage');
    GPS51ConfigStorage.saveConfiguration({
      apiUrl: this.apiUrl,
      username,
      password,
      from: 'WEB',
      type: 'USER'
    });
    
    return await this.authManager.authenticate(username, password);
  }

  /**
   * Fetch user devices
   */
  async fetchUserDevices(): Promise<GPS51Vehicle[]> {
    const username = this.authManager.getUsername();
    if (!username) {
      throw new Error('Not authenticated - call authenticate() first');
    }
    
    return await this.deviceManager.fetchUserDevices(username);
  }

  /**
   * Fetch live positions
   */
  async fetchLivePositions(deviceIds?: string[]): Promise<LiveDataResult> {
    if (!this.authManager.isAuthenticated()) {
      throw new Error('Not authenticated - call authenticate() first');
    }

    // Use device manager to get device IDs if not provided
    const targetDeviceIds = deviceIds || this.deviceManager.getDevices().map(d => d.deviceid);
    
    const result = await this.positionManager.fetchLivePositions(targetDeviceIds);
    
    // Update device manager with position data
    result.positions.forEach(position => {
      this.deviceManager.updateDeviceStatus(position.deviceid, position);
    });
    
    // Return updated vehicles
    result.vehicles = this.deviceManager.getDevices();
    
    return result;
  }

  /**
   * Calculate smart polling interval
   */
  calculatePollingInterval(): number {
    const devices = this.deviceManager.getDevices();
    return this.pollingManager.calculatePollingInterval(devices);
  }

  /**
   * Get polling recommendation
   */
  getPollingRecommendation() {
    const devices = this.deviceManager.getDevices();
    return this.pollingManager.getPollingRecommendation(devices);
  }

  /**
   * Get priority vehicles for polling
   */
  getPriorityVehicles(): string[] {
    const devices = this.deviceManager.getDevices();
    return this.pollingManager.getPriorityVehicles(devices);
  }

  /**
   * Check if immediate polling is recommended
   */
  shouldPollImmediately(): boolean {
    const devices = this.deviceManager.getDevices();
    return this.pollingManager.shouldPollImmediately(devices);
  }

  /**
   * Calculate retry delay
   */
  calculateRetryDelay(): number {
    return this.positionManager.calculateRetryDelay();
  }

  /**
   * Check if retry should be attempted
   */
  shouldRetry(): boolean {
    return this.positionManager.shouldRetry();
  }

  /**
   * Get current authentication state
   */
  getAuthState(): GPS51AuthState {
    return this.authManager.getAuthState();
  }

  /**
   * Get current devices
   */
  getDevices(): GPS51Vehicle[] {
    return this.deviceManager.getDevices();
  }

  /**
   * Get current lastQueryTime
   */
  getLastQueryTime(): number {
    return this.positionManager.getLastQueryTime();
  }

  /**
   * Reset query time
   */
  resetQueryTime(): void {
    this.positionManager.resetQueryTime();
  }

  /**
   * Get comprehensive service status
   */
  getServiceStatus() {
    const devices = this.deviceManager.getDevices();
    const pollingStats = this.pollingManager.getPollingStats(devices);
    
    return {
      // Auth status
      isAuthenticated: this.authManager.isAuthenticated(),
      username: this.authManager.getUsername(),
      
      // Device status
      deviceCount: this.deviceManager.getDeviceCount(),
      movingVehicles: this.deviceManager.getMovingDevices().length,
      stationaryVehicles: this.deviceManager.getStationaryDevices().length,
      offlineVehicles: this.deviceManager.getOfflineDevices().length,
      
      // Position status
      lastQueryTime: this.positionManager.getLastQueryTime(),
      retryCount: this.positionManager.getRetryCount(),
      
      // Polling status
      pollingStats,
      pollingRecommendation: this.pollingManager.getPollingRecommendation(devices),
      shouldPollImmediately: this.pollingManager.shouldPollImmediately(devices),
      
      // API status
      apiUrl: this.apiUrl
    };
  }

  /**
   * Logout and clear all data
   */
  async logout(): Promise<void> {
    await this.authManager.logout();
    this.deviceManager.clearDevices();
    this.positionManager.resetQueryTime();
    this.positionManager.resetRetryCount();
    
    console.log('GPS51UnifiedService: Logged out and reset all managers');
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    // Clear device manager
    this.deviceManager.clearDevices();
    
    // Reset position manager
    this.positionManager.resetQueryTime();
    this.positionManager.resetRetryCount();
    
    console.log('GPS51UnifiedService: All caches cleared');
  }
}

// Export singleton instance
export const gps51UnifiedService = GPS51UnifiedService.getInstance();