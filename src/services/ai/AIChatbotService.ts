// AI Chatbot Service - Core orchestration for vehicle AI interactions
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ChatbotConfiguration {
  id: string;
  llm_provider: string;
  api_endpoint?: string;
  model_name?: string;
  welcome_message: string;
  persona_description: string;
  conversation_history_retention_days: number;
}

export interface ChatbotFeatures {
  get_vehicle_location: boolean;
  engine_control: boolean;
  subscription_info: boolean;
  usage_history: boolean;
  general_qa: boolean;
  create_support_ticket: boolean;
  vehicle_telemetry: boolean;
}

export interface UsageLimits {
  max_prompts_per_day: number;
  max_prompts_per_week: number;
  max_prompts_per_month: number;
}

export interface ChatbotContext {
  userId: string;
  packageId?: string;
  vehicleIds: string[];
  features: ChatbotFeatures;
  usageLimits: UsageLimits;
  currentUsage: {
    today: number;
    week: number;
    month: number;
  };
}

export class AIChatbotService {
  private static instance: AIChatbotService;
  private configuration: ChatbotConfiguration | null = null;

  public static getInstance(): AIChatbotService {
    if (!AIChatbotService.instance) {
      AIChatbotService.instance = new AIChatbotService();
    }
    return AIChatbotService.instance;
  }

  async initializeConfiguration(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('chatbot_configurations')
        .select('*')
        .single();

      if (error) throw error;
      
      this.configuration = data as ChatbotConfiguration;
    } catch (error) {
      console.error('Failed to load chatbot configuration:', error);
      throw new Error('Chatbot configuration not available');
    }
  }

  async getChatbotContext(userId: string): Promise<ChatbotContext> {
    try {
      // Get user's subscription and package info
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('package_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      const packageId = subscription?.package_id;

      // Get enabled features for user's package
      const { data: features } = await supabase
        .from('chatbot_package_features')
        .select('feature_name, is_enabled')
        .eq('package_id', packageId);

      // Get usage limits
      const { data: limits } = await supabase
        .from('chatbot_usage_limits')
        .select('*')
        .eq('package_id', packageId)
        .single();

      // Get current usage
      const { data: usage } = await supabase
        .from('chatbot_usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Get user's vehicles (simplified for now)
      const vehicleIds: string[] = [];

      const enabledFeatures: ChatbotFeatures = {
        get_vehicle_location: features?.find(f => f.feature_name === 'get_vehicle_location')?.is_enabled || false,
        engine_control: features?.find(f => f.feature_name === 'engine_control')?.is_enabled || false,
        subscription_info: features?.find(f => f.feature_name === 'subscription_info')?.is_enabled || false,
        usage_history: features?.find(f => f.feature_name === 'usage_history')?.is_enabled || false,
        general_qa: features?.find(f => f.feature_name === 'general_qa')?.is_enabled || true,
        create_support_ticket: features?.find(f => f.feature_name === 'create_support_ticket')?.is_enabled || false,
        vehicle_telemetry: features?.find(f => f.feature_name === 'vehicle_telemetry')?.is_enabled || false,
      };

      return {
        userId,
        packageId,
        vehicleIds,
        features: enabledFeatures,
        usageLimits: {
          max_prompts_per_day: limits?.max_prompts_per_day || 10,
          max_prompts_per_week: limits?.max_prompts_per_week || 50,
          max_prompts_per_month: limits?.max_prompts_per_month || 200,
        },
        currentUsage: {
          today: usage?.prompts_today || 0,
          week: usage?.prompts_this_week || 0,
          month: usage?.prompts_this_month || 0,
        },
      };
    } catch (error) {
      console.error('Failed to get chatbot context:', error);
      throw new Error('Unable to load user context for chatbot');
    }
  }

  async sendMessage(
    userId: string,
    message: string,
    sessionId: string,
    context?: ChatbotContext
  ): Promise<ChatMessage> {
    try {
      if (!this.configuration) {
        await this.initializeConfiguration();
      }

      const chatContext = context || await this.getChatbotContext(userId);

      // Check usage limits
      if (!this.checkUsageLimits(chatContext)) {
        throw new Error('Usage limit exceeded. Please upgrade your subscription for more AI interactions.');
      }

      // Get conversation history
      const conversationHistory = await this.getConversationHistory(userId, sessionId);

      // Call the AI chatbot edge function
      const { data, error } = await supabase.functions.invoke('ai-vehicle-chatbot', {
        body: {
          message,
          sessionId,
          userId,
          context: chatContext,
          conversationHistory: conversationHistory.slice(-10), // Last 10 messages for context
          configuration: this.configuration,
        },
      });

      if (error) throw error;

      const response: ChatMessage = {
        id: data.messageId,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        metadata: data.metadata,
      };

      // Update usage tracking
      await this.updateUsageTracking(userId, chatContext.packageId);

      // Store conversation
      await this.storeConversation(userId, sessionId, [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        },
        response,
      ]);

      // Log action if any was performed
      if (data.actionPerformed) {
        await this.logAction(userId, sessionId, data.actionPerformed);
      }

      return response;
    } catch (error) {
      console.error('Chatbot message error:', error);
      throw error;
    }
  }

  private checkUsageLimits(context: ChatbotContext): boolean {
    return (
      context.currentUsage.today < context.usageLimits.max_prompts_per_day &&
      context.currentUsage.week < context.usageLimits.max_prompts_per_week &&
      context.currentUsage.month < context.usageLimits.max_prompts_per_month
    );
  }

  private async getConversationHistory(userId: string, sessionId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chatbot_conversations')
        .select('conversation_history')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .single();

      if (error || !data) return [];

      const history = data.conversation_history as unknown as ChatMessage[];
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }

  private async storeConversation(userId: string, sessionId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const existingHistory = await this.getConversationHistory(userId, sessionId);
      const updatedHistory = [...existingHistory, ...messages];

      const { error } = await supabase
        .from('chatbot_conversations')
        .upsert({
          user_id: userId,
          session_id: sessionId,
          conversation_history: updatedHistory as unknown as Json,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to store conversation:', error);
    }
  }

  private async updateUsageTracking(userId: string, packageId?: string): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('update-chatbot-usage', {
        body: { userId, packageId },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update usage tracking:', error);
    }
  }

  private async logAction(userId: string, conversationId: string, action: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('chatbot_audit_logs')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          action_type: action.type,
          action_details: action.details,
          success: action.success,
          error_message: action.error,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  async getWelcomeMessage(): Promise<string> {
    if (!this.configuration) {
      await this.initializeConfiguration();
    }
    return this.configuration?.welcome_message || 'Hello! How can I help you today?';
  }

  async getUserUsageStats(userId: string): Promise<{
    limits: UsageLimits;
    current: { today: number; week: number; month: number };
  }> {
    const context = await this.getChatbotContext(userId);
    return {
      limits: context.usageLimits,
      current: context.currentUsage,
    };
  }
}

export const aiChatbotService = AIChatbotService.getInstance();