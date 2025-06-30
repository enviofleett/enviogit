
export const GPS51_STATUS = {
  SUCCESS: 0,
  FAILED: 1,
  PASSWORD_ERROR: 1,
  OFFLINE_NOT_CACHE: 2,
  OFFLINE_CACHED: 3,
  TOKEN_INVALID: 4,
  NO_PERMISSION: 5,
} as const;

export const GPS51_DEFAULTS = {
  BASE_URL: 'https://api.gps51.com/openapi',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  TOKEN_EXPIRY_HOURS: 24
} as const;
