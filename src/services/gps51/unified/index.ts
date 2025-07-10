/**
 * GPS51 Unified Authentication System
 * Central export for all GPS51 authentication services
 */

import { GPS51UnifiedAuthManager } from './GPS51UnifiedAuthManager';

export { GPS51UnifiedAuthManager };

// Export singleton instance for easy access
export const gps51UnifiedAuthManager = GPS51UnifiedAuthManager.getInstance();