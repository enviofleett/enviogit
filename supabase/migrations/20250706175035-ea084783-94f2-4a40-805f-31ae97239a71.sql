-- Add commission management to service categories
ALTER TABLE public.service_categories 
ADD COLUMN commission_percentage NUMERIC(5,2) DEFAULT 5.00;

-- Create marketplace configuration table for global settings
CREATE TABLE public.marketplace_configuration (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on marketplace configuration
ALTER TABLE public.marketplace_configuration ENABLE ROW LEVEL SECURITY;

-- Create policies for marketplace configuration
CREATE POLICY "Admins can manage marketplace configuration" 
ON public.marketplace_configuration 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Authenticated users can view marketplace configuration" 
ON public.marketplace_configuration 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- Insert default global commission rate
INSERT INTO public.marketplace_configuration (setting_key, setting_value, description) VALUES 
('global_commission_rate', '{"percentage": 5.00}', 'Default commission percentage for all categories'),
('platform_settings', '{"auto_payout": true, "payout_threshold": 1000}', 'General platform settings');

-- Add commission tracking to orders
ALTER TABLE public.marketplace_orders 
ADD COLUMN applied_commission_rate NUMERIC(5,2) DEFAULT 5.00;

-- Update existing orders with default commission rate
UPDATE public.marketplace_orders 
SET applied_commission_rate = 5.00 
WHERE applied_commission_rate IS NULL;

-- Create trigger for updating marketplace configuration timestamps
CREATE TRIGGER update_marketplace_configuration_updated_at
BEFORE UPDATE ON public.marketplace_configuration
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();