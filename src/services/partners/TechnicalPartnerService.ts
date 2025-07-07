import { supabase } from '@/integrations/supabase/client';

export interface TechnicalPartner {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  email: string;
  city?: string;
  country?: string;
  bank_account_info: any;
  nin?: string;
  office_address?: string;
  profile_picture_url?: string;
  profile_literature?: string;
  status: 'pending' | 'approved' | 'rejected' | 'inactive';
  assigned_admin_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerRegistrationData {
  name: string;
  phone_number: string;
  email: string;
  city?: string;
  country?: string;
  bank_account_info: any;
  nin?: string;
  office_address?: string;
  profile_picture_url?: string;
  profile_literature?: string;
}

export interface PartnerUser {
  id: string;
  technical_partner_id: string;
  user_id: string;
  welcome_email_sent: boolean;
  created_at: string;
}

export class TechnicalPartnerService {
  
  /**
   * Register a new technical partner
   */
  static async registerPartner(data: PartnerRegistrationData): Promise<TechnicalPartner> {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      throw new Error('User must be authenticated to register as technical partner');
    }

    const { data: partner, error } = await supabase
      .from('technical_partners')
      .insert({
        user_id: currentUser.user.id,
        ...data,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error registering technical partner:', error);
      throw new Error(`Failed to register technical partner: ${error.message}`);
    }

    console.log('Technical partner registered successfully:', partner.id);
    return partner as TechnicalPartner;
  }

  /**
   * Get current partner profile
   */
  static async getCurrentPartner(): Promise<TechnicalPartner | null> {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) return null;

    const { data: partner, error } = await supabase
      .from('technical_partners')
      .select('*')
      .eq('user_id', currentUser.user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching current partner:', error);
      throw new Error(`Failed to fetch partner profile: ${error.message}`);
    }

    return partner as TechnicalPartner | null;
  }

  /**
   * Update partner profile
   */
  static async updatePartner(partnerId: string, updates: Partial<PartnerRegistrationData>): Promise<TechnicalPartner> {
    const { data: partner, error } = await supabase
      .from('technical_partners')
      .update(updates)
      .eq('id', partnerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating technical partner:', error);
      throw new Error(`Failed to update partner: ${error.message}`);
    }

    return partner as TechnicalPartner;
  }

  /**
   * Register a new user under a technical partner
   */
  static async registerPartnerUser(partnerUserId: string, userData: {
    name: string;
    phone_number: string;
    email: string;
    city?: string;
    country?: string;
  }): Promise<{ user: any; partnerUser: PartnerUser }> {
    try {
      console.log('Registering partner user:', userData);

      // Call the user registration edge function
      const { data: registrationResult, error: registrationError } = await supabase.functions.invoke('user-registration', {
        body: {
          ...userData,
          registered_by_partner: true,
          technical_partner_id: partnerUserId
        }
      });

      if (registrationError) {
        console.error('Error in user registration:', registrationError);
        throw new Error(`User registration failed: ${registrationError.message}`);
      }

      if (!registrationResult?.success) {
        throw new Error(registrationResult?.error || 'User registration failed');
      }

      console.log('Partner user registered successfully:', registrationResult.user.id);
      return {
        user: registrationResult.user,
        partnerUser: registrationResult.partnerUser
      };
    } catch (error) {
      console.error('Error registering partner user:', error);
      throw error;
    }
  }

  /**
   * Get users registered by a technical partner
   */
  static async getPartnerUsers(partnerId: string): Promise<any[]> {
    const { data: partnerUsers, error } = await supabase
      .from('partner_users')
      .select(`
        *,
        profiles:user_id (
          id,
          name,
          email,
          phone_number,
          city,
          status
        )
      `)
      .eq('technical_partner_id', partnerId);

    if (error) {
      console.error('Error fetching partner users:', error);
      throw new Error(`Failed to fetch partner users: ${error.message}`);
    }

    return partnerUsers || [];
  }

  /**
   * Get vehicles for a specific partner user
   */
  static async getPartnerUserVehicles(userId: string): Promise<any[]> {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        user_subscriptions (
          *,
          subscription_packages (
            name,
            description
          )
        )
      `)
      .eq('subscriber_id', userId);

    if (error) {
      console.error('Error fetching partner user vehicles:', error);
      throw new Error(`Failed to fetch user vehicles: ${error.message}`);
    }

    return vehicles || [];
  }

  /**
   * Admin: Get all technical partners
   */
  static async getAllPartners(status?: string): Promise<TechnicalPartner[]> {
    let query = supabase
      .from('technical_partners')
      .select(`
        *,
        assigned_admin:assigned_admin_id (
          id,
          email
        )
      `);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: partners, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all partners:', error);
      throw new Error(`Failed to fetch partners: ${error.message}`);
    }

    return (partners || []) as TechnicalPartner[];
  }

  /**
   * Admin: Update partner status
   */
  static async updatePartnerStatus(partnerId: string, status: 'approved' | 'rejected' | 'inactive', adminId?: string): Promise<TechnicalPartner> {
    const updates: any = { status };
    
    if (status === 'approved' && adminId) {
      updates.assigned_admin_id = adminId;
    }

    const { data: partner, error } = await supabase
      .from('technical_partners')
      .update(updates)
      .eq('id', partnerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating partner status:', error);
      throw new Error(`Failed to update partner status: ${error.message}`);
    }

    console.log(`Partner ${partnerId} status updated to ${status}`);
    return partner as TechnicalPartner;
  }

  /**
   * Get device types available for vehicle activation
   */
  static async getDeviceTypes(): Promise<any[]> {
    const { data: deviceTypes, error } = await supabase
      .from('device_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching device types:', error);
      throw new Error(`Failed to fetch device types: ${error.message}`);
    }

    return deviceTypes || [];
  }
}