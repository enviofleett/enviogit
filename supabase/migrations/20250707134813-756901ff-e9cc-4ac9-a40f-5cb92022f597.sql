-- Create chatbot conversation tables and configuration
CREATE TABLE public.chatbot_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  llm_provider TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  api_endpoint TEXT,
  model_name TEXT,
  welcome_message TEXT DEFAULT 'Hello! I''m your AI vehicle assistant. How can I help you today?',
  persona_description TEXT DEFAULT 'You are a helpful, concise, and polite vehicle assistant. Always prioritize user safety and privacy.',
  conversation_history_retention_days INTEGER DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chatbot package features table
CREATE TABLE public.chatbot_package_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID REFERENCES public.subscription_packages(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(package_id, feature_name)
);

-- Create chatbot usage limits table
CREATE TABLE public.chatbot_usage_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID REFERENCES public.subscription_packages(id) ON DELETE CASCADE,
  max_prompts_per_day INTEGER DEFAULT 10,
  max_prompts_per_week INTEGER DEFAULT 50,
  max_prompts_per_month INTEGER DEFAULT 200,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(package_id)
);

-- Create chatbot conversations table
CREATE TABLE public.chatbot_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chatbot usage tracking table
CREATE TABLE public.chatbot_usage_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_id UUID REFERENCES public.subscription_packages(id),
  prompts_today INTEGER DEFAULT 0,
  prompts_this_week INTEGER DEFAULT 0,
  prompts_this_month INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create chatbot audit log table
CREATE TABLE public.chatbot_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.chatbot_conversations(id),
  action_type TEXT NOT NULL,
  action_details JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.chatbot_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_package_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Chatbot configurations - admin only
CREATE POLICY "Admins can manage chatbot configurations" 
ON public.chatbot_configurations 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Package features - admin only
CREATE POLICY "Admins can manage chatbot package features" 
ON public.chatbot_package_features 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Usage limits - admin only
CREATE POLICY "Admins can manage chatbot usage limits" 
ON public.chatbot_usage_limits 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Conversations - users can only see their own
CREATE POLICY "Users can view their own conversations" 
ON public.chatbot_conversations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations" 
ON public.chatbot_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" 
ON public.chatbot_conversations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage all conversations" 
ON public.chatbot_conversations 
FOR ALL 
USING (true);

-- Usage tracking - users can see their own, system can manage all
CREATE POLICY "Users can view their own usage" 
ON public.chatbot_usage_tracking 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage usage tracking" 
ON public.chatbot_usage_tracking 
FOR ALL 
USING (true);

-- Audit logs - admins can view all, users can view their own
CREATE POLICY "Users can view their own audit logs" 
ON public.chatbot_audit_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs" 
ON public.chatbot_audit_logs 
FOR SELECT 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "System can create audit logs" 
ON public.chatbot_audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Create triggers for updated_at columns
CREATE TRIGGER update_chatbot_configurations_updated_at
  BEFORE UPDATE ON public.chatbot_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chatbot_package_features_updated_at
  BEFORE UPDATE ON public.chatbot_package_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chatbot_usage_limits_updated_at
  BEFORE UPDATE ON public.chatbot_usage_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chatbot_conversations_updated_at
  BEFORE UPDATE ON public.chatbot_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chatbot_usage_tracking_updated_at
  BEFORE UPDATE ON public.chatbot_usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration
INSERT INTO public.chatbot_configurations (id, llm_provider, welcome_message, persona_description) 
VALUES (gen_random_uuid(), 'gemini-2.0-flash', 'Hello! I''m your AI vehicle assistant. How can I help you today?', 'You are a helpful, concise, and polite vehicle assistant. Always prioritize user safety and privacy.');

-- Insert default chatbot features for packages (if subscription packages exist)
INSERT INTO public.chatbot_package_features (package_id, feature_name, is_enabled)
SELECT sp.id, 'get_vehicle_location', true
FROM public.subscription_packages sp
WHERE sp.is_active = true;

INSERT INTO public.chatbot_package_features (package_id, feature_name, is_enabled)
SELECT sp.id, 'general_qa', true
FROM public.subscription_packages sp
WHERE sp.is_active = true;

-- Insert default usage limits
INSERT INTO public.chatbot_usage_limits (package_id, max_prompts_per_day, max_prompts_per_week, max_prompts_per_month)
SELECT sp.id, 10, 50, 200
FROM public.subscription_packages sp
WHERE sp.is_active = true;