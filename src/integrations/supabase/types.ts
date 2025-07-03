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
      alert_configs: {
        Row: {
          actions: Json
          auto_resolve: boolean
          conditions: Json
          cooldown_seconds: number
          created_at: string
          description: string | null
          escalation_rules: Json | null
          id: string
          is_active: boolean
          name: string
          schedule: Json | null
          severity: string
          type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          auto_resolve?: boolean
          conditions?: Json
          cooldown_seconds?: number
          created_at?: string
          description?: string | null
          escalation_rules?: Json | null
          id?: string
          is_active?: boolean
          name: string
          schedule?: Json | null
          severity: string
          type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          auto_resolve?: boolean
          conditions?: Json
          cooldown_seconds?: number
          created_at?: string
          description?: string | null
          escalation_rules?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          schedule?: Json | null
          severity?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          config_id: string
          config_name: string
          created_at: string
          data: Json
          device_id: string | null
          escalation_level: number
          id: string
          last_escalated_at: string | null
          location: Json | null
          message: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          type: string
          vehicle_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          config_id: string
          config_name: string
          created_at?: string
          data?: Json
          device_id?: string | null
          escalation_level?: number
          id?: string
          last_escalated_at?: string | null
          location?: Json | null
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string
          title: string
          type: string
          vehicle_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          config_id?: string
          config_name?: string
          created_at?: string
          data?: Json
          device_id?: string | null
          escalation_level?: number
          id?: string
          last_escalated_at?: string | null
          location?: Json | null
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          type?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "alert_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          category: string | null
          entity_id: string | null
          entity_type: string | null
          event_time: string
          id: string
          ip_address: string | null
          message: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          category?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_time?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          category?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_time?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address: string | null
          business_hours: Json | null
          created_at: string
          email: string | null
          id: string
          licenses: string | null
          logo_url: string | null
          name: string
          phone: string | null
          registration_number: string | null
          social_links: Json | null
          tax_id: string | null
          updated_at: string
          working_hours: string | null
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          email?: string | null
          id?: string
          licenses?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          registration_number?: string | null
          social_links?: Json | null
          tax_id?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          email?: string | null
          id?: string
          licenses?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          registration_number?: string | null
          social_links?: Json | null
          tax_id?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Relationships: []
      }
      bvn_verifications: {
        Row: {
          bvn_number: string
          created_at: string
          id: string
          registration_id: string
          user_approved: boolean | null
          verification_data: Json | null
          verified: boolean | null
        }
        Insert: {
          bvn_number: string
          created_at?: string
          id?: string
          registration_id: string
          user_approved?: boolean | null
          verification_data?: Json | null
          verified?: boolean | null
        }
        Update: {
          bvn_number?: string
          created_at?: string
          id?: string
          registration_id?: string
          user_approved?: boolean | null
          verification_data?: Json | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "bvn_verifications_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "subscriber_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      communication_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          order_id: string
          payload: Json | null
          processed_at: string | null
          retry_count: number
          status: Database["public"]["Enums"]["communication_event_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          order_id: string
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number
          status?: Database["public"]["Enums"]["communication_event_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          order_id?: string
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number
          status?: Database["public"]["Enums"]["communication_event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          event_id: string | null
          id: string
          order_id: string
          provider_response: Json | null
          recipient: string
          status: Database["public"]["Enums"]["communication_log_status"]
          subject: string | null
          template_name: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          order_id: string
          provider_response?: Json | null
          recipient: string
          status: Database["public"]["Enums"]["communication_log_status"]
          subject?: string | null
          template_name?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          order_id?: string
          provider_response?: Json | null
          recipient?: string
          status?: Database["public"]["Enums"]["communication_log_status"]
          subject?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "communication_events"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_settings: {
        Row: {
          connected_by: string | null
          created_at: string
          email_templates: Json | null
          enable_email: boolean | null
          enable_sms: boolean | null
          id: string
          sender_email: string | null
          sms_api_key: string | null
          sms_provider: string | null
          sms_sender_id: string | null
          sms_templates: Json | null
          smtp_host: string | null
          smtp_pass: string | null
          smtp_port: number | null
          smtp_user: string | null
          triggers: Json | null
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          email_templates?: Json | null
          enable_email?: boolean | null
          enable_sms?: boolean | null
          id?: string
          sender_email?: string | null
          sms_api_key?: string | null
          sms_provider?: string | null
          sms_sender_id?: string | null
          sms_templates?: Json | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          triggers?: Json | null
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          email_templates?: Json | null
          enable_email?: boolean | null
          enable_sms?: boolean | null
          id?: string
          sender_email?: string | null
          sms_api_key?: string | null
          sms_provider?: string | null
          sms_sender_id?: string | null
          sms_templates?: Json | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          triggers?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      communication_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          subject: string | null
          template_name: string
          template_type: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          subject?: string | null
          template_name: string
          template_type: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          subject?: string | null
          template_name?: string
          template_type?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      content_versions: {
        Row: {
          change_summary: string | null
          changed_by: string | null
          content: string
          content_id: string
          created_at: string
          id: string
          title: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          changed_by?: string | null
          content: string
          content_id: string
          created_at?: string
          id?: string
          title: string
          version: number
        }
        Update: {
          change_summary?: string | null
          changed_by?: string | null
          content?: string
          content_id?: string
          created_at?: string
          id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "site_content"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_communication_preferences: {
        Row: {
          allow_order_updates: boolean
          allow_promotions: boolean
          created_at: string
          customer_email: string
          id: string
          language: string
          preferred_channel: string
          updated_at: string
        }
        Insert: {
          allow_order_updates?: boolean
          allow_promotions?: boolean
          created_at?: string
          customer_email: string
          id?: string
          language?: string
          preferred_channel?: string
          updated_at?: string
        }
        Update: {
          allow_order_updates?: boolean
          allow_promotions?: boolean
          created_at?: string
          customer_email?: string
          id?: string
          language?: string
          preferred_channel?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_loyalty: {
        Row: {
          current_tier: Database["public"]["Enums"]["loyalty_tier"] | null
          customer_id: string
          points_balance: number | null
          updated_at: string | null
        }
        Insert: {
          current_tier?: Database["public"]["Enums"]["loyalty_tier"] | null
          customer_id: string
          points_balance?: number | null
          updated_at?: string | null
        }
        Update: {
          current_tier?: Database["public"]["Enums"]["loyalty_tier"] | null
          customer_id?: string
          points_balance?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_fees: {
        Row: {
          base_fee: number
          created_at: string
          fee_per_km: number | null
          id: string
          min_order_for_free_delivery: number | null
          updated_at: string
          zone_id: string
        }
        Insert: {
          base_fee?: number
          created_at?: string
          fee_per_km?: number | null
          id?: string
          min_order_for_free_delivery?: number | null
          updated_at?: string
          zone_id: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          fee_per_km?: number | null
          id?: string
          min_order_for_free_delivery?: number | null
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_fees_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          area: Json
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          area: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          area?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          assigned_user_id: string | null
          created_at: string | null
          device_id: string
          device_name: string | null
          gps51_group_id: string | null
          id: string
          last_seen_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string | null
          device_id: string
          device_name?: string | null
          gps51_group_id?: string | null
          id?: string
          last_seen_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string | null
          device_id?: string
          device_name?: string | null
          gps51_group_id?: string | null
          id?: string
          last_seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_alert_rules: {
        Row: {
          actions: Json
          conditions: Json
          cooldown_minutes: number
          created_at: string
          event_types: string[]
          geofence_id: string | null
          id: string
          is_active: boolean
          last_triggered: string | null
          name: string
          priority: string
          vehicle_id: string | null
        }
        Insert: {
          actions?: Json
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          event_types: string[]
          geofence_id?: string | null
          id?: string
          is_active?: boolean
          last_triggered?: string | null
          name: string
          priority: string
          vehicle_id?: string | null
        }
        Update: {
          actions?: Json
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          event_types?: string[]
          geofence_id?: string | null
          id?: string
          is_active?: boolean
          last_triggered?: string | null
          name?: string
          priority?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geofence_alert_rules_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_events: {
        Row: {
          acknowledged: boolean
          geofence_id: string
          id: string
          location: Json
          metadata: Json | null
          severity: string
          speed: number | null
          timestamp: string
          type: string
          vehicle_id: string
        }
        Insert: {
          acknowledged?: boolean
          geofence_id: string
          id?: string
          location: Json
          metadata?: Json | null
          severity?: string
          speed?: number | null
          timestamp?: string
          type: string
          vehicle_id: string
        }
        Update: {
          acknowledged?: boolean
          geofence_id?: string
          id?: string
          location?: Json
          metadata?: Json | null
          severity?: string
          speed?: number | null
          timestamp?: string
          type?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_events_geofence_id_fkey"
            columns: ["geofence_id"]
            isOneToOne: false
            referencedRelation: "geofences"
            referencedColumns: ["id"]
          },
        ]
      }
      geofences: {
        Row: {
          alert_on_entry: boolean
          alert_on_exit: boolean
          alert_on_violation: boolean
          center_lat: number | null
          center_lng: number | null
          coordinates: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          radius: number | null
          schedules: Json | null
          tags: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          alert_on_entry?: boolean
          alert_on_exit?: boolean
          alert_on_violation?: boolean
          center_lat?: number | null
          center_lng?: number | null
          coordinates?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          radius?: number | null
          schedules?: Json | null
          tags?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          alert_on_entry?: boolean
          alert_on_exit?: boolean
          alert_on_violation?: boolean
          center_lat?: number | null
          center_lng?: number | null
          coordinates?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          radius?: number | null
          schedules?: Json | null
          tags?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      gps51_sync_jobs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          execution_time_seconds: number | null
          id: string
          positions_stored: number | null
          priority: number
          started_at: string
          success: boolean | null
          vehicles_processed: number | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          execution_time_seconds?: number | null
          id?: string
          positions_stored?: number | null
          priority: number
          started_at?: string
          success?: boolean | null
          vehicles_processed?: number | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          execution_time_seconds?: number | null
          id?: string
          positions_stored?: number | null
          priority?: number
          started_at?: string
          success?: boolean | null
          vehicles_processed?: number | null
        }
        Relationships: []
      }
      guarantor_documents: {
        Row: {
          document_type: string
          file_name: string
          file_url: string
          guarantor_id: string
          id: string
          uploaded_at: string
        }
        Insert: {
          document_type: string
          file_name: string
          file_url: string
          guarantor_id: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          document_type?: string
          file_name?: string
          file_url?: string
          guarantor_id?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantor_documents_guarantor_id_fkey"
            columns: ["guarantor_id"]
            isOneToOne: false
            referencedRelation: "guarantor_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantor_requirements: {
        Row: {
          created_at: string
          documents_uploaded_at: string | null
          email: string
          full_name: string
          guarantor_number: number
          id: string
          invitation_sent_at: string | null
          nin_number: string | null
          phone: string
          registration_id: string
          relationship: string | null
          status: Database["public"]["Enums"]["guarantor_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          documents_uploaded_at?: string | null
          email: string
          full_name: string
          guarantor_number: number
          id?: string
          invitation_sent_at?: string | null
          nin_number?: string | null
          phone: string
          registration_id: string
          relationship?: string | null
          status?: Database["public"]["Enums"]["guarantor_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          documents_uploaded_at?: string | null
          email?: string
          full_name?: string
          guarantor_number?: number
          id?: string
          invitation_sent_at?: string | null
          nin_number?: string | null
          phone?: string
          registration_id?: string
          relationship?: string | null
          status?: Database["public"]["Enums"]["guarantor_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantor_requirements_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "subscriber_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantors: {
        Row: {
          created_at: string
          document_status: string
          email: string
          full_name: string
          guarantor_number: number
          guarantor_type: string
          id: string
          nin_number: string | null
          phone: string
          photo_url: string | null
          registration_id: string
          relationship: string | null
          signed_document_url: string | null
          submitted_at: string | null
          token_expires_at: string | null
          updated_at: string
          verification_token: string | null
          verified_at: string | null
          work_id_url: string | null
        }
        Insert: {
          created_at?: string
          document_status?: string
          email: string
          full_name: string
          guarantor_number: number
          guarantor_type?: string
          id?: string
          nin_number?: string | null
          phone: string
          photo_url?: string | null
          registration_id: string
          relationship?: string | null
          signed_document_url?: string | null
          submitted_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
          verification_token?: string | null
          verified_at?: string | null
          work_id_url?: string | null
        }
        Update: {
          created_at?: string
          document_status?: string
          email?: string
          full_name?: string
          guarantor_number?: number
          guarantor_type?: string
          id?: string
          nin_number?: string | null
          phone?: string
          photo_url?: string | null
          registration_id?: string
          relationship?: string | null
          signed_document_url?: string | null
          submitted_at?: string | null
          token_expires_at?: string | null
          updated_at?: string
          verification_token?: string | null
          verified_at?: string | null
          work_id_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guarantors_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "subscriber_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      map_api_usage: {
        Row: {
          count: number
          feature_used: string
          id: string
          log_time: string
          user_id: string | null
        }
        Insert: {
          count?: number
          feature_used: string
          id?: string
          log_time?: string
          user_id?: string | null
        }
        Update: {
          count?: number
          feature_used?: string
          id?: string
          log_time?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_api_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      map_settings: {
        Row: {
          created_at: string
          id: number
          monthly_usage_limit: number | null
          updated_at: string
          usage_alert_email: string | null
          usage_alert_threshold: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          monthly_usage_limit?: number | null
          updated_at?: string
          usage_alert_email?: string | null
          usage_alert_threshold?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          monthly_usage_limit?: number | null
          updated_at?: string
          usage_alert_email?: string | null
          usage_alert_threshold?: number | null
        }
        Relationships: []
      }
      nin_verifications: {
        Row: {
          created_at: string
          id: string
          nin_number: string
          photo_url: string | null
          registration_id: string
          verification_data: Json | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          nin_number: string
          photo_url?: string | null
          registration_id: string
          verification_data?: Json | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          nin_number?: string
          photo_url?: string | null
          registration_id?: string
          verification_data?: Json | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "nin_verifications_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "subscriber_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          guarantor_id: string | null
          id: string
          notification_type: string
          recipient_email: string
          recipient_phone: string | null
          registration_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_name: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          guarantor_id?: string | null
          id?: string
          notification_type: string
          recipient_email: string
          recipient_phone?: string | null
          registration_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          guarantor_id?: string | null
          id?: string
          notification_type?: string
          recipient_email?: string
          recipient_phone?: string | null
          registration_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_guarantor_id_fkey"
            columns: ["guarantor_id"]
            isOneToOne: false
            referencedRelation: "guarantors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "subscriber_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_rider_id: string | null
          created_by: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_zone_id: string | null
          id: string
          order_number: string
          order_time: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_rider_id?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_zone_id?: string | null
          id?: string
          order_number: string
          order_time?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_rider_id?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_zone_id?: string | null
          id?: string
          order_number?: string
          order_time?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_rider_id_fkey"
            columns: ["assigned_rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_integrations: {
        Row: {
          connected_by: string | null
          connection_status: string | null
          created_at: string
          currency: string | null
          id: string
          mode: string | null
          payment_methods: Json | null
          provider: string
          public_key: string | null
          secret_key: string | null
          transaction_fee: number | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          connected_by?: string | null
          connection_status?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          mode?: string | null
          payment_methods?: Json | null
          provider: string
          public_key?: string | null
          secret_key?: string | null
          transaction_fee?: number | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          connected_by?: string | null
          connection_status?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          mode?: string | null
          payment_methods?: Json | null
          provider?: string
          public_key?: string | null
          secret_key?: string | null
          transaction_fee?: number | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      points_transactions: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          description: string | null
          id: string
          related_order_id: string | null
          type: Database["public"]["Enums"]["points_transaction_type"]
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          related_order_id?: string | null
          type: Database["public"]["Enums"]["points_transaction_type"]
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          related_order_id?: string | null
          type?: Database["public"]["Enums"]["points_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "points_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_loyalty"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      positions: {
        Row: {
          battery_voltage: number | null
          created_at: string | null
          device_id: string | null
          heading: number | null
          id: number
          ignition_on: boolean | null
          latitude: number
          longitude: number
          raw_data: Json | null
          speed_kph: number | null
          timestamp: string
        }
        Insert: {
          battery_voltage?: number | null
          created_at?: string | null
          device_id?: string | null
          heading?: number | null
          id?: never
          ignition_on?: boolean | null
          latitude: number
          longitude: number
          raw_data?: Json | null
          speed_kph?: number | null
          timestamp: string
        }
        Update: {
          battery_voltage?: number | null
          created_at?: string | null
          device_id?: string | null
          heading?: number | null
          id?: never
          ignition_on?: boolean | null
          latitude?: number
          longitude?: number
          raw_data?: Json | null
          speed_kph?: number | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          analytics_consent: boolean | null
          communication_preferences: Json | null
          consent_version: string | null
          data_retention_preference: string | null
          data_sharing_consent: Json | null
          id: string
          last_updated: string | null
          location_sharing: Json | null
          marketing_consent: boolean | null
          profile_visibility: Json | null
          subscriber_id: string | null
          third_party_sharing: boolean | null
        }
        Insert: {
          analytics_consent?: boolean | null
          communication_preferences?: Json | null
          consent_version?: string | null
          data_retention_preference?: string | null
          data_sharing_consent?: Json | null
          id?: string
          last_updated?: string | null
          location_sharing?: Json | null
          marketing_consent?: boolean | null
          profile_visibility?: Json | null
          subscriber_id?: string | null
          third_party_sharing?: boolean | null
        }
        Update: {
          analytics_consent?: boolean | null
          communication_preferences?: Json | null
          consent_version?: string | null
          data_retention_preference?: string | null
          data_sharing_consent?: Json | null
          id?: string
          last_updated?: string | null
          location_sharing?: Json | null
          marketing_consent?: boolean | null
          profile_visibility?: Json | null
          subscriber_id?: string | null
          third_party_sharing?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_settings_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: true
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_geofence_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          actions: Json
          geofence_event: Json
          id: string
          message: string
          priority: string
          rule_id: string
          rule_name: string
          triggered_at: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actions?: Json
          geofence_event: Json
          id?: string
          message: string
          priority: string
          rule_id: string
          rule_name: string
          triggered_at?: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actions?: Json
          geofence_event?: Json
          id?: string
          message?: string
          priority?: string
          rule_id?: string
          rule_name?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_geofence_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "geofence_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          created_at: string | null
          id: string
          ip_address: unknown | null
          profile_owner_id: string | null
          referrer_url: string | null
          session_id: string | null
          user_agent: string | null
          view_duration: number | null
          view_type: string | null
          viewer_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          profile_owner_id?: string | null
          referrer_url?: string | null
          session_id?: string | null
          user_agent?: string | null
          view_duration?: number | null
          view_type?: string | null
          viewer_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          profile_owner_id?: string | null
          referrer_url?: string | null
          session_id?: string | null
          user_agent?: string | null
          view_duration?: number | null
          view_type?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_owner_id_fkey"
            columns: ["profile_owner_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          id: string
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
        }
        Insert: {
          avatar_url?: string | null
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
        }
        Update: {
          avatar_url?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
        }
        Relationships: []
      }
      promotion_usage: {
        Row: {
          customer_id: string | null
          id: string
          order_id: string | null
          promotion_id: string | null
          used_at: string | null
        }
        Insert: {
          customer_id?: string | null
          id?: string
          order_id?: string | null
          promotion_id?: string | null
          used_at?: string | null
        }
        Update: {
          customer_id?: string | null
          id?: string
          order_id?: string | null
          promotion_id?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          expires_at: string | null
          id: string
          loyalty_points_reward: number | null
          min_purchase: number | null
          name: string
          per_customer_limit: number | null
          referral_reward_amount: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["promotion_status"] | null
          tier_required: Database["public"]["Enums"]["loyalty_tier"] | null
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at: string | null
          usage_limit: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          loyalty_points_reward?: number | null
          min_purchase?: number | null
          name: string
          per_customer_limit?: number | null
          referral_reward_amount?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["promotion_status"] | null
          tier_required?: Database["public"]["Enums"]["loyalty_tier"] | null
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string | null
          usage_limit?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          expires_at?: string | null
          id?: string
          loyalty_points_reward?: number | null
          min_purchase?: number | null
          name?: string
          per_customer_limit?: number | null
          referral_reward_amount?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["promotion_status"] | null
          tier_required?: Database["public"]["Enums"]["loyalty_tier"] | null
          type?: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string | null
          id: string
          referred_customer_id: string
          referrer_id: string
          reward_granted: boolean | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          referred_customer_id: string
          referrer_id: string
          reward_granted?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          referred_customer_id?: string
          referrer_id?: string
          reward_granted?: boolean | null
        }
        Relationships: []
      }
      registration_logs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          registration_id: string
          status: string
          step_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          registration_id: string
          status: string
          step_name: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          registration_id?: string
          status?: string
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_logs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "subscriber_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_tracks: {
        Row: {
          created_at: string | null
          device_id: string | null
          expires_at: string | null
          generated_by_user_id: string | null
          id: string
          shared_url: string | null
          sharing_duration_minutes: number | null
          sharing_interval_minutes: number | null
        }
        Insert: {
          created_at?: string | null
          device_id?: string | null
          expires_at?: string | null
          generated_by_user_id?: string | null
          id?: string
          shared_url?: string | null
          sharing_duration_minutes?: number | null
          sharing_interval_minutes?: number | null
        }
        Update: {
          created_at?: string | null
          device_id?: string | null
          expires_at?: string | null
          generated_by_user_id?: string | null
          id?: string
          shared_url?: string | null
          sharing_duration_minutes?: number | null
          sharing_interval_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_tracks_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "shared_tracks_generated_by_user_id_fkey"
            columns: ["generated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_integrations: {
        Row: {
          connected_by: string | null
          created_at: string
          delivery_time: string | null
          id: string
          provider: string | null
          settings: Json | null
          shipping_rates: Json | null
          status: string | null
          token: string | null
          updated_at: string
          zones: Json | null
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          delivery_time?: string | null
          id?: string
          provider?: string | null
          settings?: Json | null
          shipping_rates?: Json | null
          status?: string | null
          token?: string | null
          updated_at?: string
          zones?: Json | null
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          delivery_time?: string | null
          id?: string
          provider?: string | null
          settings?: Json | null
          shipping_rates?: Json | null
          status?: string | null
          token?: string | null
          updated_at?: string
          zones?: Json | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          title: string
          unpublished_at: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          title: string
          unpublished_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          title?: string
          unpublished_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      social_activities: {
        Row: {
          activity_data: Json | null
          activity_date: string | null
          activity_type: string | null
          created_at: string | null
          engagement_score: number | null
          id: string
          is_public: boolean | null
          location: string | null
          participants: Json | null
          subscriber_id: string | null
        }
        Insert: {
          activity_data?: Json | null
          activity_date?: string | null
          activity_type?: string | null
          created_at?: string | null
          engagement_score?: number | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          participants?: Json | null
          subscriber_id?: string | null
        }
        Update: {
          activity_data?: Json | null
          activity_date?: string | null
          activity_type?: string | null
          created_at?: string | null
          engagement_score?: number | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          participants?: Json | null
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_activities_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_achievements: {
        Row: {
          achievement_description: string | null
          achievement_name: string | null
          achievement_type: string | null
          badge_icon_url: string | null
          category: string | null
          created_at: string | null
          earned_at: string | null
          id: string
          is_visible: boolean | null
          max_progress: number | null
          points_awarded: number | null
          progress: number | null
          rarity: string | null
          subscriber_id: string | null
        }
        Insert: {
          achievement_description?: string | null
          achievement_name?: string | null
          achievement_type?: string | null
          badge_icon_url?: string | null
          category?: string | null
          created_at?: string | null
          earned_at?: string | null
          id?: string
          is_visible?: boolean | null
          max_progress?: number | null
          points_awarded?: number | null
          progress?: number | null
          rarity?: string | null
          subscriber_id?: string | null
        }
        Update: {
          achievement_description?: string | null
          achievement_name?: string | null
          achievement_type?: string | null
          badge_icon_url?: string | null
          category?: string | null
          created_at?: string | null
          earned_at?: string | null
          id?: string
          is_visible?: boolean | null
          max_progress?: number | null
          points_awarded?: number | null
          progress?: number | null
          rarity?: string | null
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriber_achievements_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_connections: {
        Row: {
          connection_type: string | null
          created_at: string | null
          id: string
          message: string | null
          mutual_connections: number | null
          receiver_id: string | null
          requester_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          connection_type?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          mutual_connections?: number | null
          receiver_id?: string | null
          requester_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          connection_type?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          mutual_connections?: number | null
          receiver_id?: string | null
          requester_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriber_connections_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriber_connections_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_levels: {
        Row: {
          category_ranks: Json | null
          created_at: string | null
          current_level: number | null
          global_rank: number | null
          id: string
          level_name: string | null
          level_progress: number | null
          local_rank: number | null
          points_to_next_level: number | null
          subscriber_id: string | null
          total_points: number | null
          updated_at: string | null
        }
        Insert: {
          category_ranks?: Json | null
          created_at?: string | null
          current_level?: number | null
          global_rank?: number | null
          id?: string
          level_name?: string | null
          level_progress?: number | null
          local_rank?: number | null
          points_to_next_level?: number | null
          subscriber_id?: string | null
          total_points?: number | null
          updated_at?: string | null
        }
        Update: {
          category_ranks?: Json | null
          created_at?: string | null
          current_level?: number | null
          global_rank?: number | null
          id?: string
          level_name?: string | null
          level_progress?: number | null
          local_rank?: number | null
          points_to_next_level?: number | null
          subscriber_id?: string | null
          total_points?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriber_levels_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: true
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_ratings: {
        Row: {
          admin_notes: string | null
          booking_id: string | null
          created_at: string | null
          helpful_votes: number | null
          id: string
          is_anonymous: boolean | null
          photos: Json | null
          rater_id: string | null
          rater_type: string
          rating: number | null
          report_count: number | null
          response_date: string | null
          response_text: string | null
          review_categories: Json | null
          review_text: string | null
          subscriber_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          booking_id?: string | null
          created_at?: string | null
          helpful_votes?: number | null
          id?: string
          is_anonymous?: boolean | null
          photos?: Json | null
          rater_id?: string | null
          rater_type: string
          rating?: number | null
          report_count?: number | null
          response_date?: string | null
          response_text?: string | null
          review_categories?: Json | null
          review_text?: string | null
          subscriber_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          booking_id?: string | null
          created_at?: string | null
          helpful_votes?: number | null
          id?: string
          is_anonymous?: boolean | null
          photos?: Json | null
          rater_id?: string | null
          rater_type?: string
          rating?: number | null
          report_count?: number | null
          response_date?: string | null
          response_text?: string | null
          review_categories?: Json | null
          review_text?: string | null
          subscriber_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriber_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriber_ratings_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriber_registrations: {
        Row: {
          admin_approved: boolean | null
          admin_notes: string | null
          bvn_data: Json | null
          bvn_number: string | null
          bvn_verified: boolean | null
          completed_at: string | null
          country_code: string
          created_at: string
          current_step: number
          email: string
          id: string
          is_active: boolean | null
          last_activity: string | null
          nin_data: Json | null
          nin_number: string | null
          nin_verified: boolean | null
          phone: string | null
          photo_url: string | null
          session_data: Json | null
          status: Database["public"]["Enums"]["registration_status"]
          subscriber_type: Database["public"]["Enums"]["subscriber_type"] | null
          total_steps: number
          updated_at: string
        }
        Insert: {
          admin_approved?: boolean | null
          admin_notes?: string | null
          bvn_data?: Json | null
          bvn_number?: string | null
          bvn_verified?: boolean | null
          completed_at?: string | null
          country_code: string
          created_at?: string
          current_step?: number
          email: string
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          nin_data?: Json | null
          nin_number?: string | null
          nin_verified?: boolean | null
          phone?: string | null
          photo_url?: string | null
          session_data?: Json | null
          status?: Database["public"]["Enums"]["registration_status"]
          subscriber_type?:
            | Database["public"]["Enums"]["subscriber_type"]
            | null
          total_steps?: number
          updated_at?: string
        }
        Update: {
          admin_approved?: boolean | null
          admin_notes?: string | null
          bvn_data?: Json | null
          bvn_number?: string | null
          bvn_verified?: boolean | null
          completed_at?: string | null
          country_code?: string
          created_at?: string
          current_step?: number
          email?: string
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          nin_data?: Json | null
          nin_number?: string | null
          nin_verified?: boolean | null
          phone?: string | null
          photo_url?: string | null
          session_data?: Json | null
          status?: Database["public"]["Enums"]["registration_status"]
          subscriber_type?:
            | Database["public"]["Enums"]["subscriber_type"]
            | null
          total_steps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriber_registrations_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "supported_countries"
            referencedColumns: ["country_code"]
          },
        ]
      }
      subscribers: {
        Row: {
          company_name: string | null
          cover_photo_url: string | null
          created_at: string | null
          date_of_birth: string | null
          driving_license_expiry: string | null
          driving_license_number: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          gender: string | null
          id: string
          is_premium_member: boolean | null
          last_active: string | null
          member_since: string | null
          occupation: string | null
          preferences: Json | null
          preferred_language: string | null
          premium_expiry: string | null
          profile_completion_percentage: number | null
          profile_description: string | null
          profile_photo_url: string | null
          profile_visibility: string | null
          registration_id: string | null
          social_links: Json | null
          time_zone: string | null
          total_distance_km: number | null
          total_spent: number | null
          total_trips: number | null
          trust_score: number | null
          updated_at: string | null
          verification_badges: Json | null
        }
        Insert: {
          company_name?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          driving_license_expiry?: string | null
          driving_license_number?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          gender?: string | null
          id?: string
          is_premium_member?: boolean | null
          last_active?: string | null
          member_since?: string | null
          occupation?: string | null
          preferences?: Json | null
          preferred_language?: string | null
          premium_expiry?: string | null
          profile_completion_percentage?: number | null
          profile_description?: string | null
          profile_photo_url?: string | null
          profile_visibility?: string | null
          registration_id?: string | null
          social_links?: Json | null
          time_zone?: string | null
          total_distance_km?: number | null
          total_spent?: number | null
          total_trips?: number | null
          trust_score?: number | null
          updated_at?: string | null
          verification_badges?: Json | null
        }
        Update: {
          company_name?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          driving_license_expiry?: string | null
          driving_license_number?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          gender?: string | null
          id?: string
          is_premium_member?: boolean | null
          last_active?: string | null
          member_since?: string | null
          occupation?: string | null
          preferences?: Json | null
          preferred_language?: string | null
          premium_expiry?: string | null
          profile_completion_percentage?: number | null
          profile_description?: string | null
          profile_photo_url?: string | null
          profile_visibility?: string | null
          registration_id?: string | null
          social_links?: Json | null
          time_zone?: string | null
          total_distance_km?: number | null
          total_spent?: number | null
          total_trips?: number | null
          trust_score?: number | null
          updated_at?: string | null
          verification_badges?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "subscriber_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      supported_countries: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          id: string
          requires_nin: boolean
          status: Database["public"]["Enums"]["country_support_status"]
          updated_at: string
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          id?: string
          requires_nin?: boolean
          status?: Database["public"]["Enums"]["country_support_status"]
          updated_at?: string
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          id?: string
          requires_nin?: boolean
          status?: Database["public"]["Enums"]["country_support_status"]
          updated_at?: string
        }
        Relationships: []
      }
      sustainability_profiles: {
        Row: {
          carbon_footprint_total: number | null
          carbon_offset_credits: number | null
          carbon_reduction_goals: Json | null
          carpooling_participation: number | null
          created_at: string | null
          eco_achievements: Json | null
          electric_vehicle_usage_percent: number | null
          hybrid_vehicle_usage_percent: number | null
          id: string
          public_transport_integration: number | null
          subscriber_id: string | null
          sustainability_score: number | null
          updated_at: string | null
        }
        Insert: {
          carbon_footprint_total?: number | null
          carbon_offset_credits?: number | null
          carbon_reduction_goals?: Json | null
          carpooling_participation?: number | null
          created_at?: string | null
          eco_achievements?: Json | null
          electric_vehicle_usage_percent?: number | null
          hybrid_vehicle_usage_percent?: number | null
          id?: string
          public_transport_integration?: number | null
          subscriber_id?: string | null
          sustainability_score?: number | null
          updated_at?: string | null
        }
        Update: {
          carbon_footprint_total?: number | null
          carbon_offset_credits?: number | null
          carbon_reduction_goals?: Json | null
          carpooling_participation?: number | null
          created_at?: string | null
          eco_achievements?: Json | null
          electric_vehicle_usage_percent?: number | null
          hybrid_vehicle_usage_percent?: number | null
          id?: string
          public_transport_integration?: number | null
          subscriber_id?: string | null
          sustainability_score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sustainability_profiles_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: true
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_statistics: {
        Row: {
          average_rating: number | null
          created_at: string | null
          eco_score: number | null
          favorite_vehicle_type: string | null
          id: string
          month_year: string | null
          most_visited_location: string | null
          on_time_percentage: number | null
          safety_incidents: number | null
          subscriber_id: string | null
          total_distance_km: number | null
          total_duration_hours: number | null
          total_spent: number | null
          total_trips: number | null
        }
        Insert: {
          average_rating?: number | null
          created_at?: string | null
          eco_score?: number | null
          favorite_vehicle_type?: string | null
          id?: string
          month_year?: string | null
          most_visited_location?: string | null
          on_time_percentage?: number | null
          safety_incidents?: number | null
          subscriber_id?: string | null
          total_distance_km?: number | null
          total_duration_hours?: number | null
          total_spent?: number | null
          total_trips?: number | null
        }
        Update: {
          average_rating?: number | null
          created_at?: string | null
          eco_score?: number | null
          favorite_vehicle_type?: string | null
          id?: string
          month_year?: string | null
          most_visited_location?: string | null
          on_time_percentage?: number | null
          safety_incidents?: number | null
          subscriber_id?: string | null
          total_distance_km?: number | null
          total_duration_hours?: number | null
          total_spent?: number | null
          total_trips?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_statistics_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_endorsements: {
        Row: {
          created_at: string | null
          endorsement_date: string | null
          endorser_id: string | null
          id: string
          is_verified: boolean | null
          public_comment: string | null
          relationship: string | null
          skill: string | null
          strength: string | null
          subscriber_id: string | null
        }
        Insert: {
          created_at?: string | null
          endorsement_date?: string | null
          endorser_id?: string | null
          id?: string
          is_verified?: boolean | null
          public_comment?: string | null
          relationship?: string | null
          skill?: string | null
          strength?: string | null
          subscriber_id?: string | null
        }
        Update: {
          created_at?: string | null
          endorsement_date?: string | null
          endorser_id?: string | null
          id?: string
          is_verified?: boolean | null
          public_comment?: string | null
          relationship?: string | null
          skill?: string | null
          strength?: string | null
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trust_endorsements_endorser_id_fkey"
            columns: ["endorser_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trust_endorsements_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          id: string
          menu_section: Database["public"]["Enums"]["menu_section"]
          permission_level: Database["public"]["Enums"]["permission_level"]
          user_id: string
        }
        Insert: {
          id?: string
          menu_section: Database["public"]["Enums"]["menu_section"]
          permission_level: Database["public"]["Enums"]["permission_level"]
          user_id: string
        }
        Update: {
          id?: string
          menu_section?: Database["public"]["Enums"]["menu_section"]
          permission_level?: Database["public"]["Enums"]["permission_level"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          gps51_username: string
          id: string
          nickname: string | null
          password_hash: string
          phone: string | null
          user_type: number | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          gps51_username: string
          id?: string
          nickname?: string | null
          password_hash: string
          phone?: string | null
          user_type?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          gps51_username?: string
          id?: string
          nickname?: string | null
          password_hash?: string
          phone?: string | null
          user_type?: number | null
        }
        Relationships: []
      }
      vehicle_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          dispatch_rider_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          dispatch_rider_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          vehicle_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          dispatch_rider_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_dispatch_rider_id_fkey"
            columns: ["dispatch_rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
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
          created_at: string
          engine_temperature: number | null
          fuel_level: number | null
          heading: number
          id: string
          ignition_status: boolean
          latitude: number
          longitude: number
          recorded_at: string
          speed: number
          timestamp: string
          vehicle_id: string
        }
        Insert: {
          accuracy?: number | null
          address?: string | null
          altitude?: number | null
          battery_level?: number | null
          created_at?: string
          engine_temperature?: number | null
          fuel_level?: number | null
          heading?: number
          id?: string
          ignition_status?: boolean
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number
          timestamp: string
          vehicle_id: string
        }
        Update: {
          accuracy?: number | null
          address?: string | null
          altitude?: number | null
          battery_level?: number | null
          created_at?: string
          engine_temperature?: number | null
          fuel_level?: number | null
          heading?: number
          id?: string
          ignition_status?: boolean
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number
          timestamp?: string
          vehicle_id?: string
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
          created_at: string
          gps51_device_id: string | null
          id: string
          license_plate: string
          model: string | null
          notes: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          gps51_device_id?: string | null
          id?: string
          license_plate: string
          model?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          gps51_device_id?: string | null
          id?: string
          license_plate?: string
          model?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Relationships: []
      }
      video_records: {
        Row: {
          channel: number | null
          created_at: string | null
          device_id: string | null
          end_time: string | null
          gps51_record_id: string | null
          id: string
          media_type: number | null
          start_time: string | null
          storage_type: number | null
        }
        Insert: {
          channel?: number | null
          created_at?: string | null
          device_id?: string | null
          end_time?: string | null
          gps51_record_id?: string | null
          id?: string
          media_type?: number | null
          start_time?: string | null
          storage_type?: number | null
        }
        Update: {
          channel?: number | null
          created_at?: string | null
          device_id?: string | null
          end_time?: string | null
          gps51_record_id?: string | null
          id?: string
          media_type?: number | null
          start_time?: string | null
          storage_type?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_records_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_cron_jobs_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_dashboard_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_role: {
        Args: { user_id_to_check: string }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      assignment_status: "active" | "inactive"
      communication_event_status: "queued" | "processing" | "sent" | "failed"
      communication_log_status:
        | "sent"
        | "delivered"
        | "bounced"
        | "failed"
        | "skipped"
      content_type:
        | "about_us"
        | "terms_of_service"
        | "privacy_policy"
        | "contact_info"
        | "faq"
        | "help_center"
      country_support_status: "active" | "inactive"
      delivery_method: "delivery" | "pickup"
      guarantor_status: "invited" | "documents_uploaded" | "verified"
      loyalty_tier: "bronze" | "silver" | "gold" | "platinum"
      menu_section:
        | "dashboard"
        | "orders"
        | "products"
        | "customers"
        | "delivery"
        | "reports"
        | "settings"
        | "promotions"
        | "audit_logs"
      order_status:
        | "confirmed"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method: "cash" | "card" | "transfer" | "paystack"
      payment_status: "pending" | "paid" | "refunded" | "failed"
      permission_level: "view" | "create" | "edit" | "delete" | "export"
      points_transaction_type: "earn" | "redeem" | "adjustment"
      product_status: "active" | "archived" | "draft"
      promotion_status: "active" | "paused" | "expired"
      promotion_type:
        | "discount"
        | "loyalty"
        | "referral"
        | "bundle"
        | "flash_sale"
      registration_status:
        | "pending"
        | "nin_verified"
        | "guarantors_pending"
        | "bvn_verified"
        | "admin_approved"
        | "completed"
      subscriber_type: "self_drive" | "charter"
      user_role: "admin" | "manager" | "staff" | "dispatch_rider"
      user_status: "active" | "inactive" | "pending"
      vehicle_status: "available" | "assigned" | "maintenance" | "inactive"
      vehicle_type: "bike" | "van" | "truck" | "sedan" | "motorcycle" | "other"
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
    Enums: {
      assignment_status: ["active", "inactive"],
      communication_event_status: ["queued", "processing", "sent", "failed"],
      communication_log_status: [
        "sent",
        "delivered",
        "bounced",
        "failed",
        "skipped",
      ],
      content_type: [
        "about_us",
        "terms_of_service",
        "privacy_policy",
        "contact_info",
        "faq",
        "help_center",
      ],
      country_support_status: ["active", "inactive"],
      delivery_method: ["delivery", "pickup"],
      guarantor_status: ["invited", "documents_uploaded", "verified"],
      loyalty_tier: ["bronze", "silver", "gold", "platinum"],
      menu_section: [
        "dashboard",
        "orders",
        "products",
        "customers",
        "delivery",
        "reports",
        "settings",
        "promotions",
        "audit_logs",
      ],
      order_status: [
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cash", "card", "transfer", "paystack"],
      payment_status: ["pending", "paid", "refunded", "failed"],
      permission_level: ["view", "create", "edit", "delete", "export"],
      points_transaction_type: ["earn", "redeem", "adjustment"],
      product_status: ["active", "archived", "draft"],
      promotion_status: ["active", "paused", "expired"],
      promotion_type: [
        "discount",
        "loyalty",
        "referral",
        "bundle",
        "flash_sale",
      ],
      registration_status: [
        "pending",
        "nin_verified",
        "guarantors_pending",
        "bvn_verified",
        "admin_approved",
        "completed",
      ],
      subscriber_type: ["self_drive", "charter"],
      user_role: ["admin", "manager", "staff", "dispatch_rider"],
      user_status: ["active", "inactive", "pending"],
      vehicle_status: ["available", "assigned", "maintenance", "inactive"],
      vehicle_type: ["bike", "van", "truck", "sedan", "motorcycle", "other"],
    },
  },
} as const
