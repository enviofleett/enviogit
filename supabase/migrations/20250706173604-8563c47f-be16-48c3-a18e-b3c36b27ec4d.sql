-- Create marketplace database schema

-- Service categories (admin managed)
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Merchants table with approval workflow
CREATE TABLE public.merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  business_phone TEXT,
  business_description TEXT,
  city TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'suspended')),
  bank_account_details JSONB DEFAULT '{}',
  social_media JSONB DEFAULT '{}',
  approval_date TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Merchant business locations
CREATE TABLE public.merchant_business_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Marketplace offerings (products/services)
CREATE TABLE public.marketplace_offerings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  banner_images JSONB DEFAULT '[]',
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('one_off', 'quarterly', 'annually', 'subscription')),
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  is_subscription BOOLEAN NOT NULL DEFAULT false,
  subscription_interval TEXT CHECK (subscription_interval IN ('monthly', 'quarterly', 'annually')),
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  service_locations JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User secret pins for secure transactions
CREATE TABLE public.user_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pin_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Marketplace orders
CREATE TABLE public.marketplace_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  offering_id UUID NOT NULL REFERENCES public.marketplace_offerings(id),
  vehicle_device_id TEXT NOT NULL, -- Links to GPS51 device
  transaction_id TEXT NOT NULL UNIQUE,
  paystack_reference TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  merchant_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid_pending_validation', 'service_validated', 'completed', 'cancelled', 'refunded')),
  payment_date TIMESTAMP WITH TIME ZONE,
  validation_date TIMESTAMP WITH TIME ZONE,
  completion_date TIMESTAMP WITH TIME ZONE,
  customer_contact_info JSONB DEFAULT '{}',
  service_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Service reviews and ratings
CREATE TABLE public.service_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  offering_id UUID NOT NULL REFERENCES public.marketplace_offerings(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Merchant payouts tracking
CREATE TABLE public.marketplace_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  paystack_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  initiated_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_business_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_categories
CREATE POLICY "Service categories are viewable by all authenticated users" ON public.service_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage service categories" ON public.service_categories
  FOR ALL USING ((auth.jwt() ->> 'role') = 'admin');

-- RLS Policies for merchants
CREATE POLICY "Merchants can view their own profile" ON public.merchants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Merchants can update their own profile" ON public.merchants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can register as merchant" ON public.merchants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all merchants" ON public.merchants
  FOR ALL USING ((auth.jwt() ->> 'role') = 'admin');

-- RLS Policies for merchant_business_locations
CREATE POLICY "Merchants can manage their own locations" ON public.merchant_business_locations
  FOR ALL USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "All authenticated users can view merchant locations" ON public.merchant_business_locations
  FOR SELECT USING (auth.role() = 'authenticated');

-- RLS Policies for marketplace_offerings
CREATE POLICY "All authenticated users can view active offerings" ON public.marketplace_offerings
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Merchants can manage their own offerings" ON public.marketplace_offerings
  FOR ALL USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all offerings" ON public.marketplace_offerings
  FOR ALL USING ((auth.jwt() ->> 'role') = 'admin');

-- RLS Policies for user_pins
CREATE POLICY "Users can manage their own PIN" ON public.user_pins
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for marketplace_orders
CREATE POLICY "Customers can view their own orders" ON public.marketplace_orders
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Merchants can view orders for their offerings" ON public.marketplace_orders
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create orders" ON public.marketplace_orders
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "System can update orders" ON public.marketplace_orders
  FOR UPDATE USING (true);

CREATE POLICY "Admins can manage all orders" ON public.marketplace_orders
  FOR ALL USING ((auth.jwt() ->> 'role') = 'admin');

-- RLS Policies for service_reviews
CREATE POLICY "All authenticated users can view reviews" ON public.service_reviews
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Customers can create reviews for their orders" ON public.service_reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own reviews" ON public.service_reviews
  FOR UPDATE USING (auth.uid() = customer_id);

-- RLS Policies for marketplace_payouts
CREATE POLICY "Merchants can view their own payouts" ON public.marketplace_payouts
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage payouts" ON public.marketplace_payouts
  FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_merchants_user_id ON public.merchants(user_id);
CREATE INDEX idx_merchants_status ON public.merchants(status);
CREATE INDEX idx_marketplace_offerings_merchant_id ON public.marketplace_offerings(merchant_id);
CREATE INDEX idx_marketplace_offerings_category_id ON public.marketplace_offerings(category_id);
CREATE INDEX idx_marketplace_offerings_is_active ON public.marketplace_offerings(is_active);
CREATE INDEX idx_marketplace_orders_customer_id ON public.marketplace_orders(customer_id);
CREATE INDEX idx_marketplace_orders_merchant_id ON public.marketplace_orders(merchant_id);
CREATE INDEX idx_marketplace_orders_status ON public.marketplace_orders(status);
CREATE INDEX idx_marketplace_orders_vehicle_device_id ON public.marketplace_orders(vehicle_device_id);
CREATE INDEX idx_service_reviews_offering_id ON public.service_reviews(offering_id);

-- Create update triggers
CREATE OR REPLACE FUNCTION update_marketplace_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_categories_updated_at BEFORE UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at_column();
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at_column();
CREATE TRIGGER update_merchant_business_locations_updated_at BEFORE UPDATE ON public.merchant_business_locations FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at_column();
CREATE TRIGGER update_marketplace_offerings_updated_at BEFORE UPDATE ON public.marketplace_offerings FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at_column();
CREATE TRIGGER update_user_pins_updated_at BEFORE UPDATE ON public.user_pins FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at_column();
CREATE TRIGGER update_marketplace_orders_updated_at BEFORE UPDATE ON public.marketplace_orders FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at_column();
CREATE TRIGGER update_service_reviews_updated_at BEFORE UPDATE ON public.service_reviews FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at_column();
CREATE TRIGGER update_marketplace_payouts_updated_at BEFORE UPDATE ON public.marketplace_payouts FOR EACH ROW EXECUTE FUNCTION update_marketplace_updated_at_column();