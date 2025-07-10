/**
 * GPS51 Unified Authentication System
 * Central export for all GPS51 authentication services
 */

import { GPS51UnifiedAuthManager } from './GPS51UnifiedAuthManager';
import { GPS51AuthVerification } from './GPS51AuthVerification';

export { GPS51UnifiedAuthManager, GPS51AuthVerification };

// Export singleton instance for easy access
export const gps51UnifiedAuthManager = GPS51UnifiedAuthManager.getInstance();