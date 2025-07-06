export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  is_active: boolean;
  commission_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Merchant {
  id: string;
  user_id: string;
  business_name: string;
  business_email: string;
  business_phone?: string;
  business_description?: string;
  city?: string;
  country?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'suspended';
  bank_account_details: Record<string, any>;
  social_media: Record<string, any>;
  approval_date?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MerchantBusinessLocation {
  id: string;
  merchant_id: string;
  location_name: string;
  address: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOffering {
  id: string;
  merchant_id: string;
  category_id: string;
  name: string;
  description?: string;
  banner_images: string[];
  pricing_model: 'one_off' | 'quarterly' | 'annually' | 'subscription';
  price: number;
  currency: string;
  is_subscription: boolean;
  subscription_interval?: 'monthly' | 'quarterly' | 'annually';
  is_favorite: boolean;
  is_active: boolean;
  service_locations: string[];
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOrder {
  id: string;
  customer_id: string;
  merchant_id: string;
  offering_id: string;
  vehicle_device_id: string;
  transaction_id: string;
  paystack_reference?: string;
  amount: number;
  currency: string;
  platform_fee: number;
  merchant_amount: number;
  applied_commission_rate: number;
  status: 'pending_payment' | 'paid_pending_validation' | 'service_validated' | 'completed' | 'cancelled' | 'refunded';
  payment_date?: string;
  validation_date?: string;
  completion_date?: string;
  customer_contact_info: Record<string, any>;
  service_details: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ServiceReview {
  id: string;
  order_id: string;
  customer_id: string;
  merchant_id: string;
  offering_id: string;
  rating: number;
  review_text?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplacePayout {
  id: string;
  merchant_id: string;
  order_id: string;
  amount: number;
  currency: string;
  paystack_transfer_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  initiated_at?: string;
  completed_at?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPin {
  id: string;
  user_id: string;
  pin_hash: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceConfiguration {
  id: string;
  setting_key: string;
  setting_value: any;
  description?: string;
  created_at: string;
  updated_at: string;
}