// Shared security utilities for production edge functions

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
  identifier: string;
}

export interface SecurityConfig {
  allowedOrigins: string[];
  rateLimits: {
    auth: RateLimitConfig;
    dashboard: RateLimitConfig;
    control: RateLimitConfig;
  };
  apiKeyRotation: {
    enabled: boolean;
    rotationIntervalHours: number;
  };
  requestSigning: {
    enabled: boolean;
    algorithm: string;
  };
}

// Production security configuration
export const PRODUCTION_SECURITY_CONFIG: SecurityConfig = {
  allowedOrigins: [
    'https://*.supabase.co',
    'https://*.vercel.app',
    'https://*.netlify.app',
    'https://localhost:3000',
    'http://localhost:3000'
  ],
  rateLimits: {
    auth: { requests: 5, windowMs: 900000, identifier: 'auth' }, // 5 requests per 15 minutes
    dashboard: { requests: 60, windowMs: 60000, identifier: 'dashboard' }, // 60 requests per minute
    control: { requests: 10, windowMs: 60000, identifier: 'control' } // 10 requests per minute
  },
  apiKeyRotation: {
    enabled: true,
    rotationIntervalHours: 24
  },
  requestSigning: {
    enabled: true,
    algorithm: 'HMAC-SHA256'
  }
};

// Enhanced CORS headers with production domains
export function getProductionCorsHeaders(origin?: string): Record<string, string> {
  const config = PRODUCTION_SECURITY_CONFIG;
  
  // Check if origin is allowed
  const isAllowedOrigin = !origin || config.allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '.*');
      return new RegExp(pattern).test(origin);
    }
    return allowed === origin;
  });

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? (origin || '*') : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-timestamp',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

// Rate limiting implementation
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export async function checkRateLimit(
  identifier: string, 
  clientId: string, 
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = `${config.identifier}:${clientId}`;
  const now = Date.now();
  
  let record = rateLimitStore.get(key);
  
  // Clean up expired records
  if (record && now > record.resetTime) {
    rateLimitStore.delete(key);
    record = undefined;
  }
  
  if (!record) {
    record = {
      count: 1,
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(key, record);
    
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetTime: record.resetTime
    };
  }
  
  if (record.count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  
  return {
    allowed: true,
    remaining: config.requests - record.count,
    resetTime: record.resetTime
  };
}

// Request signature validation
export async function validateRequestSignature(
  request: Request,
  body: string,
  secretKey: string
): Promise<boolean> {
  const signature = request.headers.get('x-signature');
  const timestamp = request.headers.get('x-timestamp');
  
  if (!signature || !timestamp) {
    return false;
  }
  
  // Check timestamp (prevent replay attacks)
  const requestTime = parseInt(timestamp);
  const now = Date.now();
  const timeDiff = Math.abs(now - requestTime);
  
  // Allow 5 minute window
  if (timeDiff > 300000) {
    return false;
  }
  
  // Generate expected signature
  const payload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return signature === `sha256=${expectedHex}`;
}

// Get client identifier for rate limiting
export function getClientIdentifier(request: Request): string {
  // Try to get user ID from authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    try {
      // Extract user ID from JWT token (simplified)
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.user_id || 'anonymous';
    } catch (error) {
      // Fallback to IP-based identification
    }
  }
  
  // Use IP address as fallback
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwardedFor?.split(',')[0] || realIp || 'unknown';
}

// Security middleware wrapper
export function withSecurity(
  handler: (req: Request) => Promise<Response>,
  config: {
    rateLimit?: RateLimitConfig;
    requireSignature?: boolean;
    secretKey?: string;
  } = {}
) {
  return async (req: Request): Promise<Response> => {
    try {
      const origin = req.headers.get('origin');
      const corsHeaders = getProductionCorsHeaders(origin);
      
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { 
          status: 200, 
          headers: corsHeaders 
        });
      }
      
      // Rate limiting
      if (config.rateLimit) {
        const clientId = getClientIdentifier(req);
        const rateLimit = await checkRateLimit('request', clientId, config.rateLimit);
        
        if (!rateLimit.allowed) {
          return new Response(JSON.stringify({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
          }), {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': config.rateLimit.requests.toString(),
              'X-RateLimit-Remaining': rateLimit.remaining.toString(),
              'X-RateLimit-Reset': rateLimit.resetTime.toString()
            }
          });
        }
      }
      
      // Request signature validation
      if (config.requireSignature && config.secretKey) {
        const body = await req.text();
        const isValid = await validateRequestSignature(req, body, config.secretKey);
        
        if (!isValid) {
          return new Response(JSON.stringify({
            error: 'Invalid request signature'
          }), {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        
        // Recreate request with consumed body
        req = new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: body
        });
      }
      
      // Execute handler
      const response = await handler(req);
      
      // Add security headers to response
      const securityHeaders = {
        ...corsHeaders,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      };
      
      // Add rate limit headers if configured
      if (config.rateLimit) {
        const clientId = getClientIdentifier(req);
        const rateLimit = await checkRateLimit('check', clientId, config.rateLimit);
        securityHeaders['X-RateLimit-Limit'] = config.rateLimit.requests.toString();
        securityHeaders['X-RateLimit-Remaining'] = rateLimit.remaining.toString();
        securityHeaders['X-RateLimit-Reset'] = rateLimit.resetTime.toString();
      }
      
      // Merge with existing headers
      const existingHeaders = Object.fromEntries(response.headers.entries());
      const mergedHeaders = { ...existingHeaders, ...securityHeaders };
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: mergedHeaders
      });
      
    } catch (error) {
      console.error('Security middleware error:', error);
      
      return new Response(JSON.stringify({
        error: 'Security validation failed'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getProductionCorsHeaders()
        }
      });
    }
  };
}