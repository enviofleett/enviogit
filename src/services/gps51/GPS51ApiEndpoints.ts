
// ==================== API ENDPOINT CONFIGURATION ====================

export interface GPS51ApiEndpoints {
  standard: {
    baseUrl: string;
    name: string;
    features: string[];
  };
  openapi: {
    baseUrl: string;
    name: string;
    features: string[];
  };
}

export const GPS51_ENDPOINTS: GPS51ApiEndpoints = {
  standard: {
    baseUrl: 'https://www.gps51.com/webapi',
    name: 'Standard Web API',
    features: ['Basic device management', 'Standard authentication', 'Legacy support']
  },
  openapi: {
    baseUrl: 'https://api.gps51.com/openapi',
    name: 'OpenAPI (RESTful)',
    features: ['Modern REST API', 'Better error handling', 'Enhanced data format', 'Improved performance']
  }
};

export const GPS51_STATUS = {
  SUCCESS: 0,
  FAILED: 1,
  PASSWORD_ERROR: 1,
  OFFLINE_NOT_CACHE: 2,
  OFFLINE_CACHED: 3,
  TOKEN_INVALID: 4,
  NO_PERMISSION: 5,
} as const;
