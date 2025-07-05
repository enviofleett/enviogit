-- Create subscription packages table
CREATE TABLE public.subscription_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_quarterly DECIMAL(10,2),
  price_annually DECIMAL(10,2),
  trial_days INTEGER DEFAULT 7,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user subscriptions table  
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_id UUID NOT NULL REFERENCES public.subscription_packages(id),
  vehicle_id UUID REFERENCES public.vehicles(id),
  status TEXT NOT NULL DEFAULT 'trial',
  trial_end_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create GPS51 feature mapping table
CREATE TABLE public.gps51_feature_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_name TEXT NOT NULL UNIQUE,
  gps51_action TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'tracking',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps51_feature_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_packages
CREATE POLICY "Subscription packages are viewable by authenticated users" 
ON public.subscription_packages 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Admins can manage subscription packages" 
ON public.subscription_packages 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscriptions" 
ON public.user_subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subscriptions" 
ON public.user_subscriptions 
FOR ALL 
USING (auth.uid() = user_id);

-- RLS Policies for gps51_feature_mapping
CREATE POLICY "GPS51 feature mapping is viewable by authenticated users" 
ON public.gps51_feature_mapping 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Admins can manage GPS51 feature mapping" 
ON public.gps51_feature_mapping 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Create triggers for updated_at
CREATE TRIGGER update_subscription_packages_updated_at
BEFORE UPDATE ON public.subscription_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default subscription packages
INSERT INTO public.subscription_packages (name, description, price_quarterly, price_annually, trial_days, features) VALUES
('Basic', 'Essential vehicle tracking features', 99.00, 299.00, 7, '["real_time_tracking", "basic_history", "vehicle_status"]'::jsonb),
('Premium', 'Advanced tracking with additional controls', 199.00, 599.00, 14, '["real_time_tracking", "full_history", "vehicle_status", "engine_control", "geofencing", "alerts"]'::jsonb),
('Enterprise', 'Complete fleet management solution', 399.00, 1199.00, 30, '["real_time_tracking", "full_history", "vehicle_status", "engine_control", "geofencing", "alerts", "live_video", "advanced_analytics", "api_access"]'::jsonb);

-- Insert GPS51 feature mappings
INSERT INTO public.gps51_feature_mapping (feature_name, gps51_action, description, category) VALUES
('real_time_tracking', 'lastposition', 'Real-time vehicle position tracking', 'tracking'),
('basic_history', 'querytracks', 'Basic historical route data (last 7 days)', 'history'),
('full_history', 'querytracks', 'Complete historical route data', 'history'),
('vehicle_status', 'querymonitorlist', 'Vehicle status and basic information', 'monitoring'),
('engine_control', 'sendcmd', 'Engine start/stop and immobilizer control', 'control'),
('geofencing', 'addgeofence', 'Create and manage geofences', 'monitoring'),
('alerts', 'queryalerts', 'Receive vehicle alerts and notifications', 'monitoring'),
('live_video', 'startvideos_sync', 'Live video streaming from vehicle cameras', 'multimedia'),
('advanced_analytics', 'querytracks', 'Advanced analytics and reporting', 'analytics'),
('api_access', 'all', 'Full API access for custom integrations', 'integration');