-- Create transactions table for all payment tracking
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  paystack_reference TEXT UNIQUE NOT NULL,
  paystack_transaction_id TEXT,
  order_id UUID,
  subscription_id UUID,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'initiated',
  payment_method TEXT,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE
);

-- Create paystack_events table for webhook audit trail
CREATE TABLE public.paystack_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  paystack_event_id TEXT UNIQUE NOT NULL,
  reference TEXT,
  data JSONB NOT NULL,
  signature_verified BOOLEAN DEFAULT false,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create merchant_payouts table for marketplace transactions
CREATE TABLE public.merchant_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  merchant_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  order_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  paystack_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  transfer_code TEXT,
  initiated_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create paystack_plans table to sync with Paystack plans
CREATE TABLE public.paystack_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paystack_plan_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  interval TEXT NOT NULL, -- monthly, quarterly, annually
  invoice_limit INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add payment-related fields to existing tables
ALTER TABLE public.user_subscriptions 
ADD COLUMN paystack_subscription_id TEXT,
ADD COLUMN paystack_subscription_code TEXT,
ADD COLUMN next_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN payment_status TEXT DEFAULT 'active',
ADD COLUMN last_payment_date TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_paystack_reference ON public.transactions(paystack_reference);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);

CREATE INDEX idx_paystack_events_event_type ON public.paystack_events(event_type);
CREATE INDEX idx_paystack_events_reference ON public.paystack_events(reference);
CREATE INDEX idx_paystack_events_processed ON public.paystack_events(processed);
CREATE INDEX idx_paystack_events_created_at ON public.paystack_events(created_at);

CREATE INDEX idx_merchant_payouts_merchant_id ON public.merchant_payouts(merchant_id);
CREATE INDEX idx_merchant_payouts_status ON public.merchant_payouts(status);
CREATE INDEX idx_merchant_payouts_created_at ON public.merchant_payouts(created_at);

CREATE INDEX idx_paystack_plans_plan_code ON public.paystack_plans(paystack_plan_code);
CREATE INDEX idx_paystack_plans_is_active ON public.paystack_plans(is_active);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paystack_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paystack_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage all transactions" 
ON public.transactions 
FOR ALL 
USING (true);

-- RLS Policies for paystack_events (system only)
CREATE POLICY "System can manage paystack events" 
ON public.paystack_events 
FOR ALL 
USING (true);

-- RLS Policies for merchant_payouts
CREATE POLICY "Merchants can view their own payouts" 
ON public.merchant_payouts 
FOR SELECT 
USING (auth.uid() = merchant_id);

CREATE POLICY "System can manage all payouts" 
ON public.merchant_payouts 
FOR ALL 
USING (true);

-- RLS Policies for paystack_plans
CREATE POLICY "Plans are viewable by authenticated users" 
ON public.paystack_plans 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "System can manage paystack plans" 
ON public.paystack_plans 
FOR ALL 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_payment_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_updated_at_column();

CREATE TRIGGER update_merchant_payouts_updated_at
BEFORE UPDATE ON public.merchant_payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_updated_at_column();

CREATE TRIGGER update_paystack_plans_updated_at
BEFORE UPDATE ON public.paystack_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_updated_at_column();