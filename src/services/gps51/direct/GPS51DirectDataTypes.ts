// Enhanced data types for GPS51 Direct Integration
export * from '../GPS51Types';

// Enhanced device interface with additional computed fields
export interface GPS51EnhancedDevice {
  // Base device properties
  deviceid: string;
  devicename: string;
  devicetype: string;
  simnum: string;
  lastactivetime: number;
  isfree: number;
  allowedit: number;
  icon: number;
  
  // Optional location data
  callat?: number;
  callon?: number;
  speed?: number;
  course?: number;
  updatetime?: number;
  status?: number;
  moving?: number;
  strstatus?: string;
  totaldistance?: number;
  altitude?: number;
  radius?: number;
  
  // Enhanced fields
  overduetime?: string;
  expirenotifytime?: string;
  remark?: string;
  creater?: string;
  videochannelcount?: number;
  stared?: string;
  loginame?: string;
  
  // Computed fields for direct integration
  isOnline?: boolean;
  isRecentlyActive?: boolean;
  activityStatus?: 'online' | 'recently_active' | 'offline';
  lastSeenFormatted?: string;
  coordinatesValid?: boolean;
  distanceFromLast?: number; // meters
  estimatedBattery?: number; // percentage
}

// Enhanced position interface with validation and metadata
export interface GPS51EnhancedPosition {
  // Base position properties
  deviceid: string;
  devicetime: number;
  arrivedtime?: number;
  updatetime: number;
  validpoistiontime?: number;
  callat: number;
  callon: number;
  altitude: number;
  radius?: number;
  speed: number;
  course: number;
  totaldistance: number;
  status: number;
  moving: number;
  strstatus: string;
  
  // Enhanced fields
  strstatusen?: string;
  alarm?: number;
  stralarm?: string;
  stralarmsen?: string;
  gotsrc?: string;
  rxlevel?: number;
  gpsvalidnum?: number;
  
  // Parking data
  parklat?: number;
  parklon?: number;
  parktime?: number;
  parkduration?: number;
  
  // Sensor data
  totaloil?: number;
  masteroil?: number;
  slaveoil?: number;
  temp1?: number;
  temp2?: number;
  temp3?: number;
  temp4?: number;
  humi1?: number;
  humi2?: number;
  voltage?: number;
  voltagev?: number;
  voltagepercent?: number;
  
  // IO and status
  iostatus?: number;
  currentoverspeedstate?: number;
  rotatestatus?: number;
  loadstatus?: number;
  weight?: number;
  reportmode?: number;
  fuel?: number;
  
  // Computed validation fields
  isValid?: boolean;
  validationErrors?: string[];
  age?: number; // seconds since update
  coordinateAccuracy?: 'high' | 'medium' | 'low' | 'invalid';
  speedCategory?: 'stationary' | 'slow' | 'normal' | 'fast' | 'overspeeding';
  movementDirection?: 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';
}

// Service configuration interfaces
export interface GPS51ServiceConfig {
  auth: {
    tokenRefreshInterval?: number;
    maxAuthRetries?: number;
    authBackoffDelay?: number;
  };
  api: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    maxConcurrentRequests?: number;
  };
  cache: {
    vehicleCacheTimeout?: number;
    positionCacheTimeout?: number;
    maxCacheSize?: number;
    enableCompression?: boolean;
  };
  polling: {
    defaultInterval?: number;
    adaptivePolling?: boolean;
    maxInterval?: number;
    minInterval?: number;
  };
  filtering: {
    enablePositionFiltering?: boolean;
    maxPositionAge?: number;
    coordinateValidation?: boolean;
    speedValidation?: boolean;
  };
  monitoring: {
    enableMetrics?: boolean;
    metricsRetention?: number;
    enableAlerts?: boolean;
    performanceThresholds?: PerformanceThresholds;
  };
}

export interface PerformanceThresholds {
  maxResponseTime?: number; // ms
  minSuccessRate?: number; // percentage
  maxConsecutiveErrors?: number;
  maxMemoryUsage?: number; // MB
}

// Real-time update interfaces
export interface GPS51RealtimeUpdate {
  type: 'position' | 'device_status' | 'alert' | 'system';
  timestamp: number;
  deviceId?: string;
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface GPS51UpdateSubscription {
  id: string;
  deviceIds: string[];
  updateTypes: string[];
  callback: (update: GPS51RealtimeUpdate) => void;
  isActive: boolean;
  lastUpdate: number;
}

// Analytics and metrics interfaces
export interface GPS51ServiceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    requestRate: number; // requests per minute
  };
  authentication: {
    currentStatus: 'authenticated' | 'expired' | 'failed';
    tokenAge: number;
    refreshCount: number;
    lastRefresh: number;
  };
  data: {
    devicesTracked: number;
    positionsReceived: number;
    dataFreshness: number; // average age in seconds
    cacheHitRate: number;
  };
  performance: {
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
    networkBandwidth: number; // KB/s
    errorRate: number; // percentage
  };
}

// Error handling interfaces
export interface GPS51ServiceError {
  code: string;
  message: string;
  category: 'auth' | 'network' | 'api' | 'data' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  context?: Record<string, any>;
  retryable: boolean;
  suggestedAction?: string;
}

// Event system interfaces
export interface GPS51ServiceEvent {
  type: string;
  timestamp: number;
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

// Validation schemas
export interface GPS51ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validate?: (value: any, object: any) => boolean;
}

export interface GPS51ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

// Data transformation interfaces
export interface GPS51DataTransformer<TInput = any, TOutput = any> {
  name: string;
  description: string;
  transform: (input: TInput) => TOutput;
  validate?: (input: TInput) => GPS51ValidationResult;
  metadata?: Record<string, any>;
}

// Connection management
export interface GPS51ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastConnected: number;
  connectionAttempts: number;
  latency: number;
  bandwidth: number;
  stability: 'excellent' | 'good' | 'fair' | 'poor';
}

// Health monitoring
export interface GPS51HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  timestamp: number;
  duration: number;
  metadata?: Record<string, any>;
}

export interface GPS51SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  checks: GPS51HealthCheck[];
  uptime: number;
  version: string;
  environment: string;
}