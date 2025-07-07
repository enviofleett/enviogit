-- Create Technical Partner Program Database Schema

-- 1. Technical Partners Table
CREATE TABLE public.technical_partners (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    city TEXT,
    country TEXT,
    bank_account_info JSONB DEFAULT '{}'::jsonb,
    nin TEXT, -- National ID Number
    office_address TEXT,
    profile_picture_url TEXT,
    profile_literature TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'inactive')),
    assigned_admin_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Partner Users Table (Users registered by Technical Partners)
CREATE TABLE public.partner_users (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    technical_partner_id UUID NOT NULL REFERENCES public.technical_partners(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    welcome_email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(technical_partner_id, user_id)
);

-- 3. Device Types Table (Admin Configurable)
CREATE TABLE public.device_types (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    configuration_sms_template TEXT NOT NULL,
    activation_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Partner Wallets Table
CREATE TABLE public.partner_wallets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    technical_partner_id UUID NOT NULL REFERENCES public.technical_partners(id) ON DELETE CASCADE UNIQUE,
    current_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Wallet Transactions Table
CREATE TABLE public.wallet_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id UUID NOT NULL REFERENCES public.partner_wallets(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('topup', 'debit', 'earnings', 'payout')),
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT, -- Paystack transaction ID or other reference
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Partner Earnings Table
CREATE TABLE public.partner_earnings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    technical_partner_id UUID NOT NULL REFERENCES public.technical_partners(id) ON DELETE CASCADE,
    user_subscription_id UUID REFERENCES public.user_subscriptions(id),
    earning_type TEXT NOT NULL CHECK (earning_type IN ('upgrade', 'renewal', 'activation')),
    amount_earned DECIMAL(10,2) NOT NULL,
    commission_percentage DECIMAL(5,2) NOT NULL,
    base_amount DECIMAL(10,2) NOT NULL,
    payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'approved', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Commission Rates Table (Admin Configurable)
CREATE TABLE public.commission_rates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_package_id UUID REFERENCES public.subscription_packages(id) ON DELETE CASCADE,
    upgrade_commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    renewal_commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    activation_commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Support Requests Table
CREATE TABLE public.support_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    technical_partner_id UUID NOT NULL REFERENCES public.technical_partners(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Vehicle Activation Audit Table
CREATE TABLE public.vehicle_activation_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    technical_partner_id UUID NOT NULL REFERENCES public.technical_partners(id) ON DELETE CASCADE,
    device_type_id UUID NOT NULL REFERENCES public.device_types(id),
    system_id TEXT NOT NULL, -- GPS51 device ID
    sms_sent BOOLEAN DEFAULT false,
    sms_response TEXT,
    initial_position_fetched BOOLEAN DEFAULT false,
    initial_position_response JSONB,
    activation_fee_charged DECIMAL(10,2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 10. Command Audit Table
CREATE TABLE public.command_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
    technical_partner_id UUID NOT NULL REFERENCES public.technical_partners(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    command_type TEXT NOT NULL CHECK (command_type IN ('engine_shutdown', 'engine_enable', 'configuration_sms', 'custom')),
    command_data JSONB NOT NULL,
    response_data JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 11. Partner Payout Requests Table
CREATE TABLE public.partner_payout_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    technical_partner_id UUID NOT NULL REFERENCES public.technical_partners(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    paid_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    paystack_transfer_code TEXT,
    paystack_transfer_id TEXT,
    failure_reason TEXT,
    bank_account_details JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.technical_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_activation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payout_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Technical Partners
CREATE POLICY "Partners can view their own profile" ON public.technical_partners
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Partners can update their own profile" ON public.technical_partners
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can register as technical partner" ON public.technical_partners
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all technical partners" ON public.technical_partners
    FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- RLS Policies for Partner Users
CREATE POLICY "Partners can manage their own users" ON public.partner_users
    FOR ALL USING (
        technical_partner_id IN (
            SELECT id FROM public.technical_partners WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all partner users" ON public.partner_users
    FOR SELECT USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- RLS Policies for Device Types
CREATE POLICY "Device types are viewable by authenticated users" ON public.device_types
    FOR SELECT USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Admins can manage device types" ON public.device_types
    FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- RLS Policies for Partner Wallets
CREATE POLICY "Partners can view their own wallet" ON public.partner_wallets
    FOR SELECT USING (
        technical_partner_id IN (
            SELECT id FROM public.technical_partners WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage partner wallets" ON public.partner_wallets
    FOR ALL USING (true);

-- RLS Policies for Wallet Transactions
CREATE POLICY "Partners can view their wallet transactions" ON public.wallet_transactions
    FOR SELECT USING (
        wallet_id IN (
            SELECT pw.id FROM public.partner_wallets pw
            JOIN public.technical_partners tp ON pw.technical_partner_id = tp.id
            WHERE tp.user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage wallet transactions" ON public.wallet_transactions
    FOR ALL USING (true);

-- RLS Policies for Partner Earnings
CREATE POLICY "Partners can view their own earnings" ON public.partner_earnings
    FOR SELECT USING (
        technical_partner_id IN (
            SELECT id FROM public.technical_partners WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage partner earnings" ON public.partner_earnings
    FOR ALL USING (true);

-- RLS Policies for Commission Rates
CREATE POLICY "Commission rates are viewable by authenticated users" ON public.commission_rates
    FOR SELECT USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Admins can manage commission rates" ON public.commission_rates
    FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- RLS Policies for Support Requests
CREATE POLICY "Partners can view support requests for their users" ON public.support_requests
    FOR SELECT USING (
        technical_partner_id IN (
            SELECT id FROM public.technical_partners WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Partners can update support requests for their users" ON public.support_requests
    FOR UPDATE USING (
        technical_partner_id IN (
            SELECT id FROM public.technical_partners WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Customers can create support requests" ON public.support_requests
    FOR INSERT WITH CHECK (auth.uid() = customer_user_id);

CREATE POLICY "Admins can manage all support requests" ON public.support_requests
    FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- RLS Policies for Vehicle Activation Audit
CREATE POLICY "Partners can view their activation audits" ON public.vehicle_activation_audit
    FOR SELECT USING (
        technical_partner_id IN (
            SELECT id FROM public.technical_partners WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage activation audits" ON public.vehicle_activation_audit
    FOR ALL USING (true);

-- RLS Policies for Command Audit
CREATE POLICY "Partners can view their command audits" ON public.command_audit
    FOR SELECT USING (
        technical_partner_id IN (
            SELECT id FROM public.technical_partners WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage command audits" ON public.command_audit
    FOR ALL USING (true);

-- RLS Policies for Partner Payout Requests
CREATE POLICY "Partners can manage their own payout requests" ON public.partner_payout_requests
    FOR ALL USING (
        technical_partner_id IN (
            SELECT id FROM public.technical_partners WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all payout requests" ON public.partner_payout_requests
    FOR ALL USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Create Triggers for Updated At
CREATE OR REPLACE FUNCTION public.update_technical_partner_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_technical_partners_updated_at
    BEFORE UPDATE ON public.technical_partners
    FOR EACH ROW
    EXECUTE FUNCTION public.update_technical_partner_updated_at_column();

CREATE TRIGGER update_device_types_updated_at
    BEFORE UPDATE ON public.device_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_wallets_updated_at
    BEFORE UPDATE ON public.partner_wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commission_rates_updated_at
    BEFORE UPDATE ON public.commission_rates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_requests_updated_at
    BEFORE UPDATE ON public.support_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_payout_requests_updated_at
    BEFORE UPDATE ON public.partner_payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert Default Device Types
INSERT INTO public.device_types (name, configuration_sms_template, activation_fee_amount, description) VALUES
('OBD Tracker', 'AT+GTDOG,{GSM_NETWORK},{APN},{IMEI},{SIM_NUMBER}#', 5000.00, 'OBD port GPS tracker with plug-and-play installation'),
('Hardwired GPS', 'AT+GTFRI,{GSM_NETWORK},{APN},{IMEI},{SIM_NUMBER}#', 7500.00, 'Professional hardwired GPS tracker for permanent installation'),
('Magnetic Tracker', 'AT+GTMAG,{GSM_NETWORK},{APN},{IMEI},{SIM_NUMBER}#', 3500.00, 'Magnetic GPS tracker for temporary vehicle monitoring');

-- Insert Default Commission Rates
INSERT INTO public.commission_rates (subscription_package_id, upgrade_commission_percentage, renewal_commission_percentage, activation_commission_percentage)
SELECT 
    sp.id,
    10.00, -- 10% commission on upgrades
    5.00,  -- 5% commission on renewals
    15.00  -- 15% commission on activations
FROM public.subscription_packages sp
WHERE sp.is_active = true;

-- Create function to automatically create wallet when partner is approved
CREATE OR REPLACE FUNCTION public.create_partner_wallet()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create wallet when status changes to 'approved'
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        INSERT INTO public.partner_wallets (technical_partner_id)
        VALUES (NEW.id)
        ON CONFLICT (technical_partner_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_partner_wallet_trigger
    AFTER UPDATE ON public.technical_partners
    FOR EACH ROW
    EXECUTE FUNCTION public.create_partner_wallet();