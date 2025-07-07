import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ChatbotContext {
  userId: string;
  packageId?: string;
  vehicleIds: string[];
  features: {
    get_vehicle_location: boolean;
    engine_control: boolean;
    subscription_info: boolean;
    usage_history: boolean;
    general_qa: boolean;
    create_support_ticket: boolean;
    vehicle_telemetry: boolean;
  };
  usageLimits: {
    max_prompts_per_day: number;
    max_prompts_per_week: number;
    max_prompts_per_month: number;
  };
  currentUsage: {
    today: number;
    week: number;
    month: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    const { 
      message, 
      sessionId, 
      userId, 
      context, 
      conversationHistory, 
      configuration 
    } = await req.json() as {
      message: string;
      sessionId: string;
      userId: string;
      context: ChatbotContext;
      conversationHistory: ChatMessage[];
      configuration: any;
    };

    // Verify user matches token
    if (user.id !== userId) {
      throw new Error('User ID mismatch');
    }

    // Build system prompt with available tools
    let systemPrompt = `${configuration.persona_description}\n\nYou are an AI assistant for a vehicle tracking platform. `;
    
    const availableTools: string[] = [];
    if (context.features.get_vehicle_location) {
      availableTools.push('get_vehicle_location');
      systemPrompt += 'You can get vehicle locations. ';
    }
    if (context.features.engine_control) {
      availableTools.push('engine_control');
      systemPrompt += 'You can control vehicle engines (with explicit user confirmation). ';
    }
    if (context.features.subscription_info) {
      availableTools.push('subscription_info');
      systemPrompt += 'You can provide subscription information. ';
    }
    if (context.features.vehicle_telemetry) {
      availableTools.push('vehicle_telemetry');
      systemPrompt += 'You can access vehicle telemetry data. ';
    }

    systemPrompt += `\n\nAvailable tools: ${availableTools.join(', ')}\n\nIf the user asks for something that requires a tool, respond with a JSON object like:
{
  "action": "tool_name",
  "parameters": {...},
  "confirmation_required": true/false,
  "response": "your natural language response"
}

For general questions, just respond naturally without any JSON.`;

    // Prepare messages for LLM
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Call Gemini 2.0 Flash (using Canvas environment access)
    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, but I cannot process your request right now.';

    let actionPerformed = null;
    let finalResponse = responseText;

    // Check if response contains an action (JSON format)
    try {
      const parsedResponse = JSON.parse(responseText);
      if (parsedResponse.action && availableTools.includes(parsedResponse.action)) {
        // Execute the action
        actionPerformed = await executeAction(parsedResponse.action, parsedResponse.parameters, context, supabase);
        finalResponse = parsedResponse.response;
        
        if (actionPerformed.success && actionPerformed.result) {
          finalResponse += `\n\n${actionPerformed.result}`;
        } else if (!actionPerformed.success) {
          finalResponse += `\n\nI encountered an error: ${actionPerformed.error}`;
        }
      }
    } catch (e) {
      // Not JSON, treat as regular response
    }

    return new Response(JSON.stringify({
      messageId: crypto.randomUUID(),
      response: finalResponse,
      actionPerformed,
      metadata: {
        model: 'gemini-2.0-flash',
        tokensUsed: geminiData.usageMetadata?.totalTokenCount || 0,
        timestamp: new Date().toISOString(),
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI Chatbot error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      messageId: crypto.randomUUID(),
      response: 'I apologize, but I encountered an error processing your request. Please try again.',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeAction(action: string, parameters: any, context: ChatbotContext, supabase: any) {
  try {
    switch (action) {
      case 'get_vehicle_location':
        if (!context.features.get_vehicle_location) {
          throw new Error('Vehicle location access not enabled for your subscription');
        }
        
        // Mock implementation - would integrate with GPS51 API
        return {
          success: true,
          result: 'Your vehicle is currently located at Lagos, Nigeria (Lat: 6.5244, Lng: 3.3792)',
          type: action,
          details: parameters
        };

      case 'engine_control':
        if (!context.features.engine_control) {
          throw new Error('Engine control not enabled for your subscription');
        }
        
        // Mock implementation - would integrate with GPS51 command service
        const action_type = parameters.action; // 'enable' or 'disable'
        return {
          success: true,
          result: `Engine ${action_type} command sent successfully. Please wait for confirmation.`,
          type: action,
          details: parameters
        };

      case 'subscription_info':
        if (!context.features.subscription_info) {
          throw new Error('Subscription info access not enabled');
        }
        
        // Get subscription info from database
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select(`
            status,
            subscription_end_date,
            subscription_packages(name, description)
          `)
          .eq('user_id', context.userId)
          .eq('status', 'active')
          .single();

        if (subscription) {
          return {
            success: true,
            result: `Your current subscription: ${subscription.subscription_packages?.name || 'Standard'}\nStatus: ${subscription.status}\nExpires: ${subscription.subscription_end_date ? new Date(subscription.subscription_end_date).toLocaleDateString() : 'No expiry'}`,
            type: action,
            details: subscription
          };
        } else {
          return {
            success: false,
            error: 'No active subscription found',
            type: action,
            details: null
          };
        }

      case 'vehicle_telemetry':
        if (!context.features.vehicle_telemetry) {
          throw new Error('Vehicle telemetry access not enabled for your subscription');
        }
        
        // Mock implementation - would get real telemetry data
        return {
          success: true,
          result: 'Vehicle Status:\n• Speed: 45 km/h\n• Fuel: 75%\n• Engine: Normal\n• Battery: 12.4V\n• Temperature: 92°C',
          type: action,
          details: parameters
        };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      type: action,
      details: parameters
    };
  }
}