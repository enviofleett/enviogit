export interface PaymentTransaction {
  id: string;
  user_id: string;
  paystack_reference: string;
  paystack_transaction_id?: string;
  order_id?: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'success' | 'failed' | 'refunded' | 'cancelled';
  payment_method?: string;
  customer_email: string;
  customer_name?: string;
  description?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  verified_at?: string;
  failed_at?: string;
  refunded_at?: string;
}

export interface PaystackEvent {
  id: string;
  event_type: string;
  paystack_event_id: string;
  reference?: string;
  data: Record<string, any>;
  signature_verified: boolean;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

export interface MerchantPayout {
  id: string;
  transaction_id: string;
  merchant_id: string;
  order_id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  paystack_transfer_id?: string;
  status: 'pending' | 'initiated' | 'completed' | 'failed';
  transfer_code?: string;
  initiated_at?: string;
  completed_at?: string;
  failed_at?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface PaystackPlan {
  id: string;
  paystack_plan_code: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually';
  invoice_limit?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentInitRequest {
  amount: number;
  currency?: string;
  email: string;
  description?: string;
  order_id?: string;
  subscription_plan_code?: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  secret_pin?: string;
}

export interface PaymentInitResponse {
  success: boolean;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
  error?: string;
  message?: string;
  executionTime?: number;
}

export interface WebhookEvent {
  event: string;
  data: {
    id: string;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    customer: {
      email: string;
      customer_code: string;
    };
    metadata: Record<string, any>;
    channel: string;
    fees: number;
    gateway_response: string;
    created_at: string;
    paid_at: string;
  };
}

export interface SubscriptionData {
  id: string;
  customer: {
    email: string;
    customer_code: string;
    metadata: Record<string, any>;
  };
  plan: {
    id: string;
    name: string;
    plan_code: string;
    amount: number;
    interval: string;
  };
  subscription_code: string;
  email_token: string;
  status: string;
  quantity: number;
  amount: number;
  authorization: {
    authorization_code: string;
    card_type: string;
    last4: string;
    exp_month: string;
    exp_year: string;
    bin: string;
    bank: string;
    channel: string;
    signature: string;
    reusable: boolean;
    country_code: string;
  };
  invoice_limit: number;
  split_code?: string;
  next_payment_date: string;
  created_at: string;
}

export interface TransferData {
  id: string;
  amount: number;
  currency: string;
  domain: string;
  failures: null;
  integration: number;
  reason: string;
  reference: string;
  source: string;
  source_details: null;
  status: string;
  titan_code: null;
  transfer_code: string;
  transferred_at: null;
  recipient: {
    active: boolean;
    currency: string;
    description: string;
    domain: string;
    email: null;
    id: number;
    integration: number;
    metadata: null;
    name: string;
    recipient_code: string;
    type: string;
    is_deleted: boolean;
    details: {
      authorization_code: null;
      account_number: string;
      account_name: string;
      bank_code: string;
      bank_name: string;
    };
    created_at: string;
    updated_at: string;
  };
  session: {
    provider: null;
    id: null;
  };
  created_at: string;
  updated_at: string;
}