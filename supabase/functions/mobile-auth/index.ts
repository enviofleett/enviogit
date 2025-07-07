import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSecurity, PRODUCTION_SECURITY_CONFIG } from "../_shared/security.ts";
import { md5 } from "https://esm.sh/js-md5@0.8.3";

// GPS51Utils equivalent for edge function environment
class EdgeGPS51Utils {
  static validateMD5Hash(password: string): boolean {
    // Check if password is a valid MD5 hash (32 lowercase hex characters)
    const md5Regex = /^[a-f0-9]{32}$/;
    return md5Regex.test(password);
  }

  static ensureMD5Hash(password: string): string {
    if (!password) {
      throw new Error('Password is required for MD5 hashing');
    }

    // If password is already a valid MD5 hash, return as-is
    if (this.validateMD5Hash(password)) {
      console.log('EdgeGPS51Utils: Password already MD5 hashed');
      return password;
    }
    
    const hashedPassword = md5(password).toLowerCase();
    console.log('EdgeGPS51Utils: Password successfully hashed to MD5');
    return hashedPassword;
  }

  static analyzeGPS51Error(error: any, context: string): {
    errorType: 'network' | 'authentication' | 'server' | 'data' | 'timeout' | 'rate_limit' | 'unknown';
    message: string;
    suggestions: string[];
    isRetryable: boolean;
  } {
    const suggestions: string[] = [];
    let errorType: 'network' | 'authentication' | 'server' | 'data' | 'timeout' | 'rate_limit' | 'unknown' = 'unknown';
    let message = error?.message || 'Unknown error occurred';
    let isRetryable = false;

    // GPS51-specific error codes
    if (error.status === 8902 || message.includes('8902')) {
      errorType = 'rate_limit';
      message = 'GPS51 rate limit exceeded';
      suggestions.push('Wait before retrying');
      suggestions.push('Reduce request frequency');
      isRetryable = true;
    }
    // Authentication errors
    else if (error.status === 1 || message.includes('401') || message.includes('unauthorized')) {
      errorType = 'authentication';
      message = 'GPS51 authentication failed';
      suggestions.push('Verify GPS51 credentials are correct');
      suggestions.push('Check if password is properly MD5 hashed');
      isRetryable = false;
    }
    // Network errors
    else if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
      errorType = 'network';
      message = 'Network connection error';
      suggestions.push('Check internet connection');
      suggestions.push('Verify GPS51 API URL is accessible');
      isRetryable = true;
    }
    // Server errors
    else if (message.includes('500') || message.includes('502') || message.includes('503')) {
      errorType = 'server';
      message = 'GPS51 server error';
      suggestions.push('GPS51 server may be temporarily unavailable');
      suggestions.push('Try again in a few minutes');
      isRetryable = true;
    }

    return { errorType, message, suggestions, isRetryable };
  }
}

interface MobileAuthRequest {
  email: string;
  password: string;
  deviceInfo?: {
    platform: string;
    deviceId: string;
    appVersion: string;
  };
}

const secureHandler = async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    const { email, password, deviceInfo }: MobileAuthRequest = await req.json();

    // Enhanced validation with detailed logging
    if (!email || !password) {
      console.error('Mobile Auth: Missing required fields:', { hasEmail: !!email, hasPassword: !!password });
      throw new Error("Email and password are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Mobile Auth: Invalid email format:', email);
      throw new Error("Invalid email format");
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Phase 1: Use consistent MD5 hashing
    let hashedPassword: string;
    try {
      hashedPassword = EdgeGPS51Utils.ensureMD5Hash(password);
      
      console.log('Mobile Auth: Password processing completed:', {
        email,
        originalPasswordLength: password.length,
        hashedPasswordLength: hashedPassword.length,
        isValidMD5: EdgeGPS51Utils.validateMD5Hash(hashedPassword),
        deviceInfo
      });
    } catch (hashError) {
      console.error('Mobile Auth: Password hashing failed:', hashError);
      throw new Error(`Password processing failed: ${hashError.message}`);
    }

    // Phase 2: Enhanced GPS51 authentication with proper parameter validation
    console.log('Mobile Auth: Initiating GPS51 authentication:', {
      email,
      hasValidPassword: EdgeGPS51Utils.validateMD5Hash(hashedPassword),
      platform: deviceInfo?.platform || 'unknown',
      timestamp: new Date().toISOString()
    });

    let proxyResponse: any;
    let proxyError: any;
    let retryCount = 0;
    const maxRetries = 3;

    // Enhanced retry logic with exponential backoff
    while (retryCount < maxRetries) {
      try {
        const { data, error } = await supabaseClient.functions.invoke('gps51-proxy', {
          body: {
            action: 'login',
            params: {
              username: email,
              password: hashedPassword,
              from: deviceInfo?.platform === 'ios' ? 'IPHONE' : 
                    deviceInfo?.platform === 'android' ? 'ANDROID' : 'WEB',
              type: 'USER'
            },
            method: 'POST'
          }
        });

        proxyResponse = data;
        proxyError = error;
        
        if (!proxyError && proxyResponse) {
          console.log('Mobile Auth: GPS51 proxy call successful on attempt:', retryCount + 1);
          break;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.warn(`Mobile Auth: GPS51 proxy attempt ${retryCount} failed, retrying in ${backoffDelay}ms:`, error);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      } catch (invokeError) {
        console.error(`Mobile Auth: GPS51 proxy invoke error on attempt ${retryCount + 1}:`, invokeError);
        proxyError = invokeError;
        retryCount++;
        
        if (retryCount < maxRetries) {
          const backoffDelay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // Phase 3: Enhanced error analysis and handling
    if (proxyError) {
      const errorAnalysis = EdgeGPS51Utils.analyzeGPS51Error(proxyError, 'login');
      console.error('Mobile Auth: GPS51 proxy failed after all retries:', {
        error: proxyError,
        analysis: errorAnalysis,
        retryCount,
        email
      });
      
      throw new Error(`GPS51 authentication failed: ${errorAnalysis.message} (${errorAnalysis.errorType})`);
    }

    if (!proxyResponse) {
      console.error('Mobile Auth: No response from GPS51 proxy after all retries');
      throw new Error('GPS51 service unavailable - no response received');
    }

    // Enhanced GPS51 response validation
    console.log('Mobile Auth: GPS51 response received:', {
      hasResponse: !!proxyResponse,
      status: proxyResponse.status,
      statusType: typeof proxyResponse.status,
      hasToken: !!proxyResponse.token,
      hasUser: !!proxyResponse.user,
      message: proxyResponse.message
    });

    // Normalize status to handle string responses
    const normalizedStatus = parseInt(proxyResponse.status) || proxyResponse.status;

    if (normalizedStatus !== 0 && normalizedStatus !== '0') {
      const errorAnalysis = EdgeGPS51Utils.analyzeGPS51Error(proxyResponse, 'login');
      console.error('Mobile Auth: GPS51 authentication unsuccessful:', {
        response: proxyResponse,
        analysis: errorAnalysis,
        email
      });
      
      throw new Error(`GPS51 authentication failed: ${proxyResponse.message || errorAnalysis.message} (Status: ${normalizedStatus})`);
    }

    if (!proxyResponse.token) {
      console.error('Mobile Auth: GPS51 response missing token:', proxyResponse);
      throw new Error('GPS51 authentication incomplete - no token received');
    }

    console.log('Mobile Auth: GPS51 authentication successful:', {
      username: email,
      hasToken: !!proxyResponse.token,
      hasUser: !!proxyResponse.user,
      tokenLength: proxyResponse.token?.length,
      userDetails: proxyResponse.user ? {
        username: proxyResponse.user.username,
        hasId: !!proxyResponse.user.id
      } : null
    });

    // Enhanced profile management with better error handling
    let userProfile: any;
    try {
      const profileQuery = await supabaseClient
        .from('profiles')
        .select(`
          *,
          user_subscriptions (
            *,
            subscription_packages (*)
          )
        `)
        .eq('email', email)
        .maybeSingle();

      if (profileQuery.error && profileQuery.error.code !== 'PGRST116') {
        console.error('Mobile Auth: Profile query error:', profileQuery.error);
        throw profileQuery.error;
      }

      userProfile = profileQuery.data;
      
      // Create profile if doesn't exist (GPS51-only account)
      if (!userProfile) {
        console.log('Mobile Auth: Creating new profile for GPS51-only account:', email);
        
        const profileData = {
          email: email,
          name: proxyResponse.user?.username || email.split('@')[0],
          role: 'user',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: newProfile, error: createError } = await supabaseClient
          .from('profiles')
          .insert(profileData)
          .select()
          .single();

        if (createError) {
          console.warn('Mobile Auth: Profile creation failed, using temporary profile:', createError);
          // Continue with temporary profile for GPS51-only authentication
          userProfile = {
            id: crypto.randomUUID(),
            ...profileData,
            user_subscriptions: []
          };
        } else {
          userProfile = newProfile;
          console.log('Mobile Auth: New profile created successfully:', userProfile.id);
        }
      } else {
        console.log('Mobile Auth: Existing profile found:', userProfile.id);
      }
    } catch (profileError) {
      console.error('Mobile Auth: Profile management error:', profileError);
      // Create minimal temporary profile to allow GPS51-only login
      userProfile = {
        id: crypto.randomUUID(),
        email: email,
        name: proxyResponse.user?.username || email.split('@')[0],
        role: 'user',
        status: 'active',
        user_subscriptions: []
      };
    }

    // Enhanced vehicle data retrieval with error handling
    let vehicles: any[] = [];
    try {
      if (userProfile.id) {
        const { data: vehicleData, error: vehicleError } = await supabaseClient
          .from('vehicles')
          .select('*')
          .eq('subscriber_id', userProfile.id);

        if (vehicleError) {
          console.warn('Mobile Auth: Vehicle query failed:', vehicleError);
        } else {
          vehicles = vehicleData || [];
          console.log('Mobile Auth: Vehicle data retrieved:', vehicles.length);
        }
      }
    } catch (vehicleError) {
      console.warn('Mobile Auth: Vehicle retrieval error:', vehicleError);
      // Continue without vehicles - GPS51 auth was successful
    }

    // Enhanced activity logging with error handling
    try {
      await supabaseClient
        .from('activity_logs')
        .insert({
          user_id: userProfile.id,
          activity_type: 'mobile_login',
          description: 'User logged in via mobile app (GPS51-first)',
          device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
          metadata: {
            gps51_login: true,
            platform: deviceInfo?.platform || 'unknown',
            authentication_method: 'gps51_first',
            login_timestamp: new Date().toISOString(),
            processing_time_ms: Date.now() - startTime
          }
        });
    } catch (logError) {
      console.warn('Mobile Auth: Activity logging failed:', logError);
      // Continue - logging failure shouldn't block successful authentication
    }

    const authResponse = {
      success: true,
      message: "GPS51 authentication successful",
      auth: {
        gps51Token: proxyResponse.token,
        gps51User: proxyResponse.user,
        sessionExpiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
        authMethod: 'gps51_first'
      },
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone_number,
        city: userProfile.city,
        role: userProfile.role,
        status: userProfile.status
      },
      subscription: userProfile.user_subscriptions?.[0] || null,
      vehicles: vehicles,
      metadata: {
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };

    console.log('Mobile Auth: Authentication completed successfully:', {
      email,
      userId: userProfile.id,
      vehicleCount: vehicles.length,
      processingTime: Date.now() - startTime
    });

    return new Response(JSON.stringify(authResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    
    // Enhanced error logging with context
    const errorContext = {
      message: error.message,
      stack: error.stack,
      processingTime,
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent'),
      origin: req.headers.get('origin')
    };

    console.error("Mobile Auth: Authentication failed:", errorContext);
    
    // Analyze error for better user feedback
    let userFriendlyMessage = error.message;
    let statusCode = 401;

    if (error.message.includes('Email and password are required')) {
      statusCode = 400;
    } else if (error.message.includes('Invalid email format')) {
      statusCode = 400;
    } else if (error.message.includes('GPS51 service unavailable')) {
      statusCode = 503;
      userFriendlyMessage = 'GPS tracking service is temporarily unavailable. Please try again later.';
    } else if (error.message.includes('rate limit')) {
      statusCode = 429;
      userFriendlyMessage = 'Too many login attempts. Please wait a moment before trying again.';
    } else if (error.message.includes('Network')) {
      statusCode = 503;
      userFriendlyMessage = 'Network connectivity issue. Please check your connection and try again.';
    }
    
    return new Response(JSON.stringify({ 
      error: userFriendlyMessage,
      success: false,
      errorCode: error.name || 'AUTHENTICATION_ERROR',
      timestamp: new Date().toISOString(),
      processingTime
    }), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// Apply production security middleware
const handler = withSecurity(secureHandler, {
  rateLimit: PRODUCTION_SECURITY_CONFIG.rateLimits.auth,
  requireSignature: false // Optional for auth endpoint
});

serve(handler);