export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      user_subscriptions: {
        Row: {
          created_at: string
          id: string
          package_id: string
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
          package_id: string
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
          package_id?: string
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
