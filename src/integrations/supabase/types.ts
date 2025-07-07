export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string | null
          device_info: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_calls_monitor: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string
          error_message: string | null
          id: string
          method: string
          request_payload: Json | null
          response_body: Json | null
          response_status: number
          timestamp: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          error_message?: string | null
          id?: string
          method?: string
          request_payload?: Json | null
          response_body?: Json | null
          response_status: number
          timestamp?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          error_message?: string | null
          id?: string
          method?: string
          request_payload?: Json | null
          response_body?: Json | null
          response_status?: number
          timestamp?: string
        }
        Relationships: []
      }
      email_configurations: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          provider_name: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          provider_name: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          provider_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          alert_id: string | null
          content: string | null
          created_at: string
          delivery_status: string
          device_id: string | null
          error_message: string | null
          id: string
          provider_response: Json | null
          provider_used: string | null
          recipient_email: string
          retry_count: number | null
          sent_at: string | null
          subject: string
          template_id: string | null
          updated_at: string
          user_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          alert_id?: string | null
          content?: string | null
          created_at?: string
          delivery_status?: string
          device_id?: string | null
          error_message?: string | null
          id?: string
          provider_response?: Json | null
          provider_used?: string | null
          recipient_email: string
          retry_count?: number | null
          sent_at?: string | null
          subject: string
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          alert_id?: string | null
          content?: string | null
          created_at?: string
          delivery_status?: string
          device_id?: string | null
          error_message?: string | null
          id?: string
          provider_response?: Json | null
          provider_used?: string | null
          recipient_email?: string
          retry_count?: number | null
          sent_at?: string | null
          subject?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          alert_emails: boolean | null
          created_at: string
          driver_notifications: boolean | null
          email_frequency: string | null
          geofence_alerts: boolean | null
          id: string
          maintenance_alerts: boolean | null
          marketing_emails: boolean | null
          monthly_reports: boolean | null
          report_emails: boolean | null
          updated_at: string
          user_id: string
          weekly_reports: boolean | null
        }
        Insert: {
          alert_emails?: boolean | null
          created_at?: string
          driver_notifications?: boolean | null
          email_frequency?: string | null
          geofence_alerts?: boolean | null
          id?: string
          maintenance_alerts?: boolean | null
          marketing_emails?: boolean | null
          monthly_reports?: boolean | null
          report_emails?: boolean | null
          updated_at?: string
          user_id: string
          weekly_reports?: boolean | null
        }
        Update: {
          alert_emails?: boolean | null
          created_at?: string
          driver_notifications?: boolean | null
          email_frequency?: string | null
          geofence_alerts?: boolean | null
          id?: string
          maintenance_alerts?: boolean | null
          marketing_emails?: boolean | null
          monthly_reports?: boolean | null
          report_emails?: boolean | null
          updated_at?: string
          user_id?: string
          weekly_reports?: boolean | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_template: string
          created_at: string
          gps51_data_fields: Json | null
          id: string
          is_active: boolean | null
          name: string
          subject_template: string
          template_type: string
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          gps51_data_fields?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          subject_template: string
          template_type: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          gps51_data_fields?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject_template?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      fuel_consumption_reports: {
        Row: {
          actual_consumption: number | null
          analysis_data: Json | null
          average_speed: number | null
          cost_estimate: number | null
          created_at: string
          deviation_percentage: number | null
          device_id: string
          efficiency_rating: string | null
          id: string
          manufacturer_stated_consumption: number | null
          report_period_end: string
          report_period_start: string
          speed_adjusted_consumption: number | null
          speed_distribution: Json | null
          total_distance_km: number | null
          total_fuel_used_liters: number | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          actual_consumption?: number | null
          analysis_data?: Json | null
          average_speed?: number | null
          cost_estimate?: number | null
          created_at?: string
          deviation_percentage?: number | null
          device_id: string
          efficiency_rating?: string | null
          id?: string
          manufacturer_stated_consumption?: number | null
          report_period_end: string
          report_period_start: string
          speed_adjusted_consumption?: number | null
          speed_distribution?: Json | null
          total_distance_km?: number | null
          total_fuel_used_liters?: number | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          actual_consumption?: number | null
          analysis_data?: Json | null
          average_speed?: number | null
          cost_estimate?: number | null
          created_at?: string
          deviation_percentage?: number | null
          device_id?: string
          efficiency_rating?: string | null
          id?: string
          manufacturer_stated_consumption?: number | null
          report_period_end?: string
          report_period_start?: string
          speed_adjusted_consumption?: number | null
          speed_distribution?: Json | null
          total_distance_km?: number | null
          total_fuel_used_liters?: number | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_consumption_reports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps51_feature_mapping: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          feature_name: string
          gps51_action: string
          id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          feature_name: string
          gps51_action: string
          id?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          feature_name?: string
          gps51_action?: string
          id?: string
        }
        Relationships: []
      }
      gps51_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          execution_time_seconds: number | null
          id: string
          job_type: string
          positions_processed: number | null
          positions_stored: number | null
          priority: number | null
          results: Json | null
          started_at: string | null
          status: string
          success: boolean | null
          sync_parameters: Json | null
          updated_at: string
          vehicles_processed: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          execution_time_seconds?: number | null
          id?: string
          job_type: string
          positions_processed?: number | null
          positions_stored?: number | null
          priority?: number | null
          results?: Json | null
          started_at?: string | null
          status?: string
          success?: boolean | null
          sync_parameters?: Json | null
          updated_at?: string
          vehicles_processed?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          execution_time_seconds?: number | null
          id?: string
          job_type?: string
          positions_processed?: number | null
          positions_stored?: number | null
          priority?: number | null
          results?: Json | null
          started_at?: string | null
          status?: string
          success?: boolean | null
          sync_parameters?: Json | null
          updated_at?: string
          vehicles_processed?: number | null
        }
        Relationships: []
      }
      manufacturer_fuel_data: {
        Row: {
          brand: string
          city_consumption: number | null
          combined_consumption: number | null
          created_at: string
          engine_size: string | null
          engine_type: string | null
          fuel_type: string
          highway_consumption: number | null
          historical_trends: Json | null
          id: string
          model: string
          speed_impact_data: Json | null
          transmission_type: string | null
          updated_at: string
          vehicle_category: string | null
          year: number
        }
        Insert: {
          brand: string
          city_consumption?: number | null
          combined_consumption?: number | null
          created_at?: string
          engine_size?: string | null
          engine_type?: string | null
          fuel_type?: string
          highway_consumption?: number | null
          historical_trends?: Json | null
          id?: string
          model: string
          speed_impact_data?: Json | null
          transmission_type?: string | null
          updated_at?: string
          vehicle_category?: string | null
          year: number
        }
        Update: {
          brand?: string
          city_consumption?: number | null
          combined_consumption?: number | null
          created_at?: string
          engine_size?: string | null
          engine_type?: string | null
          fuel_type?: string
          highway_consumption?: number | null
          historical_trends?: Json | null
          id?: string
          model?: string
          speed_impact_data?: Json | null
          transmission_type?: string | null
          updated_at?: string
          vehicle_category?: string | null
          year?: number
        }
        Relationships: []
      }
      marketplace_configuration: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_offerings: {
        Row: {
          banner_images: Json | null
          category_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          is_favorite: boolean
          is_subscription: boolean
          merchant_id: string
          name: string
          price: number
          pricing_model: string
          service_locations: Json | null
          subscription_interval: string | null
          updated_at: string
        }
        Insert: {
          banner_images?: Json | null
          category_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          is_subscription?: boolean
          merchant_id: string
          name: string
          price: number
          pricing_model: string
          service_locations?: Json | null
          subscription_interval?: string | null
          updated_at?: string
        }
        Update: {
          banner_images?: Json | null
          category_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          is_subscription?: boolean
          merchant_id?: string
          name?: string
          price?: number
          pricing_model?: string
          service_locations?: Json | null
          subscription_interval?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_offerings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_offerings_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          amount: number
          applied_commission_rate: number | null
          completion_date: string | null
          created_at: string
          currency: string
          customer_contact_info: Json | null
          customer_id: string
          id: string
          merchant_amount: number
          merchant_id: string
          offering_id: string
          payment_date: string | null
          paystack_reference: string | null
          platform_fee: number
          service_details: Json | null
          status: string
          transaction_id: string
          updated_at: string
          validation_date: string | null
          vehicle_device_id: string
        }
        Insert: {
          amount: number
          applied_commission_rate?: number | null
          completion_date?: string | null
          created_at?: string
          currency?: string
          customer_contact_info?: Json | null
          customer_id: string
          id?: string
          merchant_amount: number
          merchant_id: string
          offering_id: string
          payment_date?: string | null
          paystack_reference?: string | null
          platform_fee?: number
          service_details?: Json | null
          status?: string
          transaction_id: string
          updated_at?: string
          validation_date?: string | null
          vehicle_device_id: string
        }
        Update: {
          amount?: number
          applied_commission_rate?: number | null
          completion_date?: string | null
          created_at?: string
          currency?: string
          customer_contact_info?: Json | null
          customer_id?: string
          id?: string
          merchant_amount?: number
          merchant_id?: string
          offering_id?: string
          payment_date?: string | null
          paystack_reference?: string | null
          platform_fee?: number
          service_details?: Json | null
          status?: string
          transaction_id?: string
          updated_at?: string
          validation_date?: string | null
          vehicle_device_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "marketplace_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          initiated_at: string | null
          merchant_id: string
          order_id: string
          paystack_transfer_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          merchant_id: string
          order_id: string
          paystack_transfer_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          merchant_id?: string
          order_id?: string
          paystack_transfer_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payouts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_business_locations: {
        Row: {
          address: string
          city: string
          country: string
          created_at: string
          id: string
          is_primary: boolean
          latitude: number | null
          location_name: string
          longitude: number | null
          merchant_id: string
          updated_at: string
        }
        Insert: {
          address: string
          city: string
          country: string
          created_at?: string
          id?: string
          is_primary?: boolean
          latitude?: number | null
          location_name: string
          longitude?: number | null
          merchant_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          latitude?: number | null
          location_name?: string
          longitude?: number | null
          merchant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_business_locations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          initiated_at: string | null
          merchant_id: string
          net_amount: number
          order_id: string
          paystack_transfer_id: string | null
          platform_fee: number
          status: string
          transaction_id: string
          transfer_code: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          merchant_id: string
          net_amount: number
          order_id: string
          paystack_transfer_id?: string | null
          platform_fee?: number
          status?: string
          transaction_id: string
          transfer_code?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          merchant_id?: string
          net_amount?: number
          order_id?: string
          paystack_transfer_id?: string | null
          platform_fee?: number
          status?: string
          transaction_id?: string
          transfer_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payouts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payouts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          approval_date: string | null
          approved_by: string | null
          bank_account_details: Json | null
          business_description: string | null
          business_email: string
          business_name: string
          business_phone: string | null
          city: string | null
          country: string | null
          created_at: string
          id: string
          social_media: Json | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approval_date?: string | null
          approved_by?: string | null
          bank_account_details?: Json | null
          business_description?: string | null
          business_email: string
          business_name: string
          business_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          social_media?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approval_date?: string | null
          approved_by?: string | null
          bank_account_details?: Json | null
          business_description?: string | null
          business_email?: string
          business_name?: string
          business_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          social_media?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      models: {
        Row: {
          created_at: string | null
          id: string
          name: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_notifications: boolean | null
          id: string
          marketing_emails: boolean | null
          push_notifications: boolean | null
          sms_notifications: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          marketing_emails?: boolean | null
          push_notifications?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          marketing_emails?: boolean | null
          push_notifications?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      paystack_events: {
        Row: {
          created_at: string | null
          data: Json
          error_message: string | null
          event_type: string
          id: string
          paystack_event_id: string
          processed: boolean | null
          processed_at: string | null
          reference: string | null
          retry_count: number | null
          signature_verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          data: Json
          error_message?: string | null
          event_type: string
          id?: string
          paystack_event_id: string
          processed?: boolean | null
          processed_at?: string | null
          reference?: string | null
          retry_count?: number | null
          signature_verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          error_message?: string | null
          event_type?: string
          id?: string
          paystack_event_id?: string
          processed?: boolean | null
          processed_at?: string | null
          reference?: string | null
          retry_count?: number | null
          signature_verified?: boolean | null
        }
        Relationships: []
      }
      paystack_plans: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          description: string | null
          id: string
          interval: string
          invoice_limit: number | null
          is_active: boolean | null
          name: string
          paystack_plan_code: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          interval: string
          invoice_limit?: number | null
          is_active?: boolean | null
          name: string
          paystack_plan_code: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          interval?: string
          invoice_limit?: number | null
          is_active?: boolean | null
          name?: string
          paystack_plan_code?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string | null
          phone_number: string | null
          role: string | null
          status: string | null
          tutorial_watched: boolean | null
          updated_at: string | null
          vehicle_added: boolean | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name?: string | null
          phone_number?: string | null
          role?: string | null
          status?: string | null
          tutorial_watched?: boolean | null
          updated_at?: string | null
          vehicle_added?: boolean | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone_number?: string | null
          role?: string | null
          status?: string | null
          tutorial_watched?: boolean | null
          updated_at?: string | null
          vehicle_added?: boolean | null
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          commission_percentage: number | null
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          commission_percentage?: number | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          commission_percentage?: number | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_reviews: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          merchant_id: string
          offering_id: string
          order_id: string
          rating: number
          review_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          merchant_id: string
          offering_id: string
          order_id: string
          rating: number
          review_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          merchant_id?: string
          offering_id?: string
          order_id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_reviews_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reviews_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "marketplace_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_packages: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_annually: number | null
          price_quarterly: number | null
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price_annually?: number | null
          price_quarterly?: number | null
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_annually?: number | null
          price_quarterly?: number | null
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      synthetic_monitoring_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          description: string | null
          environment: string | null
          id: string
          metadata: Json | null
          notification_sent: boolean
          resolved_at: string | null
          resolved_by: string | null
          scenario_id: string | null
          severity: string
          test_run_id: string | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          description?: string | null
          environment?: string | null
          id?: string
          metadata?: Json | null
          notification_sent?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scenario_id?: string | null
          severity?: string
          test_run_id?: string | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          description?: string | null
          environment?: string | null
          id?: string
          metadata?: Json | null
          notification_sent?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          scenario_id?: string | null
          severity?: string
          test_run_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "synthetic_monitoring_alerts_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "synthetic_test_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synthetic_monitoring_alerts_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "synthetic_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      synthetic_test_results: {
        Row: {
          api_calls: Json | null
          completed_at: string | null
          created_at: string
          error_details: Json | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          performance_metrics: Json | null
          scenario_id: string
          screenshots: Json | null
          started_at: string
          status: string
          step_results: Json
          steps_executed: number
          steps_failed: number
          steps_passed: number
          test_run_id: string
        }
        Insert: {
          api_calls?: Json | null
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          performance_metrics?: Json | null
          scenario_id: string
          screenshots?: Json | null
          started_at: string
          status: string
          step_results?: Json
          steps_executed?: number
          steps_failed?: number
          steps_passed?: number
          test_run_id: string
        }
        Update: {
          api_calls?: Json | null
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          performance_metrics?: Json | null
          scenario_id?: string
          screenshots?: Json | null
          started_at?: string
          status?: string
          step_results?: Json
          steps_executed?: number
          steps_failed?: number
          steps_passed?: number
          test_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synthetic_test_results_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "synthetic_test_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synthetic_test_results_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "synthetic_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      synthetic_test_runs: {
        Row: {
          completed_at: string | null
          configuration: Json | null
          created_at: string
          environment: string
          error_summary: string | null
          execution_time_ms: number | null
          failed_scenarios: number
          id: string
          passed_scenarios: number
          run_type: string
          skipped_scenarios: number
          started_at: string
          status: string
          total_scenarios: number
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          configuration?: Json | null
          created_at?: string
          environment?: string
          error_summary?: string | null
          execution_time_ms?: number | null
          failed_scenarios?: number
          id?: string
          passed_scenarios?: number
          run_type?: string
          skipped_scenarios?: number
          started_at?: string
          status?: string
          total_scenarios?: number
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          configuration?: Json | null
          created_at?: string
          environment?: string
          error_summary?: string | null
          execution_time_ms?: number | null
          failed_scenarios?: number
          id?: string
          passed_scenarios?: number
          run_type?: string
          skipped_scenarios?: number
          started_at?: string
          status?: string
          total_scenarios?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      synthetic_test_scenarios: {
        Row: {
          created_at: string
          description: string | null
          environment: string
          expected_outcomes: Json
          id: string
          is_active: boolean
          name: string
          priority: number
          retry_count: number
          scenario_type: string
          tags: Json | null
          test_steps: Json
          timeout_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          environment?: string
          expected_outcomes?: Json
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          retry_count?: number
          scenario_type: string
          tags?: Json | null
          test_steps?: Json
          timeout_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          environment?: string
          expected_outcomes?: Json
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          retry_count?: number
          scenario_type?: string
          tags?: Json | null
          test_steps?: Json
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      test_environments: {
        Row: {
          base_url: string
          created_at: string
          database_config: Json
          description: string | null
          environment_type: string
          gps51_config: Json
          health_status: string | null
          id: string
          is_active: boolean
          last_health_check: string | null
          name: string
          paystack_config: Json
          updated_at: string
        }
        Insert: {
          base_url: string
          created_at?: string
          database_config?: Json
          description?: string | null
          environment_type: string
          gps51_config?: Json
          health_status?: string | null
          id?: string
          is_active?: boolean
          last_health_check?: string | null
          name: string
          paystack_config?: Json
          updated_at?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          database_config?: Json
          description?: string | null
          environment_type?: string
          gps51_config?: Json
          health_status?: string | null
          id?: string
          is_active?: boolean
          last_health_check?: string | null
          name?: string
          paystack_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      trackers: {
        Row: {
          activation_date: string | null
          created_at: string | null
          id: string
          imei: string | null
          model_id: string | null
          sim_number: string | null
          status: string | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          activation_date?: string | null
          created_at?: string | null
          id?: string
          imei?: string | null
          model_id?: string | null
          sim_number?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          activation_date?: string | null
          created_at?: string | null
          id?: string
          imei?: string | null
          model_id?: string | null
          sim_number?: string | null
          status?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trackers_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trackers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          customer_email: string
          customer_name: string | null
          description: string | null
          failed_at: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          payment_method: string | null
          paystack_reference: string
          paystack_transaction_id: string | null
          refunded_at: string | null
          status: string
          subscription_id: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          customer_email: string
          customer_name?: string | null
          description?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_method?: string | null
          paystack_reference: string
          paystack_transaction_id?: string | null
          refunded_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          customer_email?: string
          customer_name?: string | null
          description?: string | null
          failed_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_method?: string | null
          paystack_reference?: string
          paystack_transaction_id?: string | null
          refunded_at?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pins: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
          salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          id: string
          last_payment_date: string | null
          next_payment_date: string | null
          package_id: string
          payment_status: string | null
          paystack_subscription_code: string | null
          paystack_subscription_id: string | null
          status: string
          subscription_end_date: string | null
          trial_end_date: string | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_payment_date?: string | null
          next_payment_date?: string | null
          package_id: string
          payment_status?: string | null
          paystack_subscription_code?: string | null
          paystack_subscription_id?: string | null
          status?: string
          subscription_end_date?: string | null
          trial_end_date?: string | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_payment_date?: string | null
          next_payment_date?: string | null
          package_id?: string
          payment_status?: string | null
          paystack_subscription_code?: string | null
          paystack_subscription_id?: string | null
          status?: string
          subscription_end_date?: string | null
          trial_end_date?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "subscription_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_fuel_profiles: {
        Row: {
          created_at: string
          custom_fuel_capacity: number | null
          efficiency_target: number | null
          id: string
          manufacturer_data_id: string | null
          preferred_fuel_price: number | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          custom_fuel_capacity?: number | null
          efficiency_target?: number | null
          id?: string
          manufacturer_data_id?: string | null
          preferred_fuel_price?: number | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          custom_fuel_capacity?: number | null
          efficiency_target?: number | null
          id?: string
          manufacturer_data_id?: string | null
          preferred_fuel_price?: number | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_fuel_profiles_manufacturer_data_id_fkey"
            columns: ["manufacturer_data_id"]
            isOneToOne: false
            referencedRelation: "manufacturer_fuel_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fuel_profiles_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_positions: {
        Row: {
          accuracy: number | null
          address: string | null
          altitude: number | null
          battery_level: number | null
          city: string | null
          country: string | null
          created_at: string
          device_id: string
          engine_hours: number | null
          engine_temperature: number | null
          fuel_level: number | null
          heading: number | null
          id: string
          ignition_status: boolean | null
          latitude: number
          longitude: number
          odometer: number | null
          raw_data: Json | null
          speed: number | null
          status: string | null
          temperature: number | null
          timestamp: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          accuracy?: number | null
          address?: string | null
          altitude?: number | null
          battery_level?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_id: string
          engine_hours?: number | null
          engine_temperature?: number | null
          fuel_level?: number | null
          heading?: number | null
          id?: string
          ignition_status?: boolean | null
          latitude: number
          longitude: number
          odometer?: number | null
          raw_data?: Json | null
          speed?: number | null
          status?: string | null
          temperature?: number | null
          timestamp: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          accuracy?: number | null
          address?: string | null
          altitude?: number | null
          battery_level?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_id?: string
          engine_hours?: number | null
          engine_temperature?: number | null
          fuel_level?: number | null
          heading?: number | null
          id?: string
          ignition_status?: boolean | null
          latitude?: number
          longitude?: number
          odometer?: number | null
          raw_data?: Json | null
          speed?: number | null
          status?: string | null
          temperature?: number | null
          timestamp?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_positions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          created_at: string | null
          gps51_device_id: string | null
          id: string
          license_plate: string | null
          make: string | null
          model: string | null
          notes: string | null
          plate: string | null
          status: string | null
          subscriber_id: string | null
          type: string | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          gps51_device_id?: string | null
          id?: string
          license_plate?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          plate?: string | null
          status?: string | null
          subscriber_id?: string | null
          type?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          gps51_device_id?: string | null
          id?: string
          license_plate?: string | null
          make?: string | null
          model?: string | null
          notes?: string | null
          plate?: string | null
          status?: string | null
          subscriber_id?: string | null
          type?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_user_role: {
        Args: {
          target_user_id: string
          new_role: string
          admin_user_id: string
        }
        Returns: undefined
      }
      promote_user_to_admin: {
        Args: { user_email: string }
        Returns: undefined
      }
      set_custom_claims: {
        Args: { user_id: string; claims: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
