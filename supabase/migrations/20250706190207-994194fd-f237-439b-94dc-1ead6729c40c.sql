-- Create synthetic monitoring database schema

-- Table for storing test scenario definitions
CREATE TABLE public.synthetic_test_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('customer', 'merchant', 'technical_partner', 'admin')),
  test_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_outcomes JSONB NOT NULL DEFAULT '{}'::jsonb,
  environment TEXT NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'staging', 'production')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  timeout_seconds INTEGER NOT NULL DEFAULT 300,
  retry_count INTEGER NOT NULL DEFAULT 3,
  priority INTEGER NOT NULL DEFAULT 1,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for tracking test execution runs
CREATE TABLE public.synthetic_test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL DEFAULT 'scheduled' CHECK (run_type IN ('manual', 'scheduled', 'ci_cd', 'api')),
  environment TEXT NOT NULL DEFAULT 'test',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  total_scenarios INTEGER NOT NULL DEFAULT 0,
  passed_scenarios INTEGER NOT NULL DEFAULT 0,
  failed_scenarios INTEGER NOT NULL DEFAULT 0,
  skipped_scenarios INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER,
  triggered_by UUID REFERENCES auth.users(id),
  configuration JSONB DEFAULT '{}'::jsonb,
  error_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for detailed test results per scenario
CREATE TABLE public.synthetic_test_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_run_id UUID NOT NULL REFERENCES public.synthetic_test_runs(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES public.synthetic_test_scenarios(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_time_ms INTEGER,
  steps_executed INTEGER NOT NULL DEFAULT 0,
  steps_passed INTEGER NOT NULL DEFAULT 0,
  steps_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  step_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  screenshots JSONB DEFAULT '[]'::jsonb,
  api_calls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for managing test environments
CREATE TABLE public.test_environments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  environment_type TEXT NOT NULL CHECK (environment_type IN ('development', 'test', 'staging', 'production')),
  base_url TEXT NOT NULL,
  gps51_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  paystack_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  database_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for synthetic monitoring alerts
CREATE TABLE public.synthetic_monitoring_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('test_failure', 'environment_down', 'performance_degradation', 'critical_path_failure')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  test_run_id UUID REFERENCES public.synthetic_test_runs(id),
  scenario_id UUID REFERENCES public.synthetic_test_scenarios(id),
  environment TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.synthetic_test_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthetic_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthetic_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthetic_monitoring_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for synthetic_test_scenarios
CREATE POLICY "Admins can manage test scenarios" ON public.synthetic_test_scenarios
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Authenticated users can view active test scenarios" ON public.synthetic_test_scenarios
  FOR SELECT USING (auth.role() = 'authenticated'::text AND is_active = true);

-- RLS Policies for synthetic_test_runs
CREATE POLICY "Admins can manage test runs" ON public.synthetic_test_runs
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "System can create test runs" ON public.synthetic_test_runs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for synthetic_test_results
CREATE POLICY "Admins can view test results" ON public.synthetic_test_results
  FOR SELECT USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "System can manage test results" ON public.synthetic_test_results
  FOR ALL USING (true);

-- RLS Policies for test_environments
CREATE POLICY "Admins can manage test environments" ON public.test_environments
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- RLS Policies for synthetic_monitoring_alerts
CREATE POLICY "Admins can manage monitoring alerts" ON public.synthetic_monitoring_alerts
  FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_synthetic_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_synthetic_test_scenarios_updated_at
  BEFORE UPDATE ON public.synthetic_test_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_synthetic_updated_at_column();

CREATE TRIGGER update_test_environments_updated_at
  BEFORE UPDATE ON public.test_environments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_synthetic_updated_at_column();

-- Insert default test environment
INSERT INTO public.test_environments (name, description, environment_type, base_url, gps51_config, paystack_config, database_config)
VALUES (
  'Default Test Environment',
  'Default test environment for synthetic monitoring',
  'test',
  'http://localhost:3000',
  '{"test_mode": true, "test_devices": []}',
  '{"sandbox": true, "test_keys": true}',
  '{"test_database": true}'
);

-- Insert sample test scenarios
INSERT INTO public.synthetic_test_scenarios (name, description, scenario_type, test_steps, expected_outcomes) VALUES
('Customer Registration Flow', 'Tests complete customer registration and login process', 'customer', 
 '[{"step": "register", "action": "POST /api/register", "data": {"email": "test@example.com"}}, {"step": "verify_otp", "action": "POST /api/verify-otp"}, {"step": "login", "action": "POST /api/login"}]',
 '{"registration_success": true, "login_success": true, "profile_created": true}'
),
('Merchant Onboarding', 'Tests merchant registration and approval workflow', 'merchant',
 '[{"step": "merchant_register", "action": "POST /api/merchant/register"}, {"step": "admin_approval", "action": "PUT /api/admin/approve-merchant"}, {"step": "merchant_login", "action": "POST /api/login"}]',
 '{"merchant_created": true, "approval_success": true, "login_success": true}'
),
('Vehicle GPS51 Integration', 'Tests vehicle addition and GPS51 API integration', 'customer',
 '[{"step": "add_vehicle", "action": "POST /api/vehicles"}, {"step": "gps51_config", "action": "GPS51 setcommand"}, {"step": "fetch_position", "action": "GPS51 lastposition"}]',
 '{"vehicle_added": true, "gps51_configured": true, "position_fetched": true}'
),
('Marketplace Purchase Flow', 'Tests complete marketplace purchase with Paystack', 'customer',
 '[{"step": "browse_marketplace", "action": "GET /api/marketplace/offerings"}, {"step": "initiate_purchase", "action": "POST /api/marketplace/orders"}, {"step": "process_payment", "action": "Paystack sandbox payment"}]',
 '{"offerings_loaded": true, "order_created": true, "payment_success": true}'
);