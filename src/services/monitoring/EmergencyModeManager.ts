/**
 * Emergency Mode Manager
 * Provides centralized control for emergency spike elimination
 */
export class EmergencyModeManager {
  private static instance: EmergencyModeManager;
  private emergencyMode = true; // Default to emergency mode to prevent spikes
  
  static getInstance(): EmergencyModeManager {
    if (!EmergencyModeManager.instance) {
      EmergencyModeManager.instance = new EmergencyModeManager();
    }
    return EmergencyModeManager.instance;
  }

  isEmergencyMode(): boolean {
    return this.emergencyMode;
  }

  enableEmergencyMode(): void {
    this.emergencyMode = true;
    console.log('EmergencyModeManager: Emergency mode ENABLED - All monitoring and excessive logging disabled');
  }

  disableEmergencyMode(): void {
    this.emergencyMode = false;
    console.log('EmergencyModeManager: Emergency mode DISABLED - Normal operations can resume');
  }

  shouldSkipLogging(): boolean {
    return this.emergencyMode;
  }

  shouldSkipMonitoring(): boolean {
    return this.emergencyMode;
  }
}

export const emergencyModeManager = EmergencyModeManager.getInstance();