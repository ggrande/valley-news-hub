export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_inquiries: {
        Row: {
          budget_range: string | null
          campaign_type: string | null
          company: string | null
          contact_name: string | null
          created_at: string
          details: string | null
          email: string | null
          id: string
          is_handled: boolean | null
          phone: string | null
        }
        Insert: {
          budget_range?: string | null
          campaign_type?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string
          details?: string | null
          email?: string | null
          id?: string
          is_handled?: boolean | null
          phone?: string | null
        }
        Update: {
          budget_range?: string | null
          campaign_type?: string | null
          company?: string | null
          contact_name?: string | null
          created_at?: string
          details?: string | null
          email?: string | null
          id?: string
          is_handled?: boolean | null
          phone?: string | null
        }
        Relationships: []
      }
      affiliate_directory_entries: {
        Row: {
          approved: boolean
          city: string | null
          created_at: string
          display_name: string
          id: string
          license_id: string | null
          logo_url: string | null
          owner_user_id: string
          region: string | null
          tagline: string | null
          updated_at: string
          website_url: string
        }
        Insert: {
          approved?: boolean
          city?: string | null
          created_at?: string
          display_name: string
          id?: string
          license_id?: string | null
          logo_url?: string | null
          owner_user_id: string
          region?: string | null
          tagline?: string | null
          updated_at?: string
          website_url: string
        }
        Update: {
          approved?: boolean
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          license_id?: string | null
          logo_url?: string | null
          owner_user_id?: string
          region?: string | null
          tagline?: string | null
          updated_at?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_directory_entries_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generation_logs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          model: string | null
          post_id: string | null
          prompt: string | null
          reddit_import_id: string | null
          result: Json | null
          tokens_used: number | null
          variation: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          post_id?: string | null
          prompt?: string | null
          reddit_import_id?: string | null
          result?: Json | null
          tokens_used?: number | null
          variation?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          model?: string | null
          post_id?: string | null
          prompt?: string | null
          reddit_import_id?: string | null
          result?: Json | null
          tokens_used?: number | null
          variation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_logs_reddit_import_id_fkey"
            columns: ["reddit_import_id"]
            isOneToOne: false
            referencedRelation: "reddit_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          title: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          title?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          title?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      closings: {
        Row: {
          county: string | null
          created_at: string
          effective_date: string
          expires_at: string | null
          id: string
          name: string
          note: string | null
          status: Database["public"]["Enums"]["closing_status"]
          type: Database["public"]["Enums"]["closing_type"]
          updated_at: string
        }
        Insert: {
          county?: string | null
          created_at?: string
          effective_date?: string
          expires_at?: string | null
          id?: string
          name: string
          note?: string | null
          status?: Database["public"]["Enums"]["closing_status"]
          type?: Database["public"]["Enums"]["closing_type"]
          updated_at?: string
        }
        Update: {
          county?: string | null
          created_at?: string
          effective_date?: string
          expires_at?: string | null
          id?: string
          name?: string
          note?: string | null
          status?: Database["public"]["Enums"]["closing_status"]
          type?: Database["public"]["Enums"]["closing_type"]
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          display_name: string
          id: string
          is_featured: boolean
          is_hidden: boolean
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          nesting_level: number
          parent_comment_id: string | null
          parent_source_comment_id: string | null
          post_id: string
          score: number | null
          sort_order: number
          source_comment_id: string | null
          source_created_at: string | null
          source_type: Database["public"]["Enums"]["comment_source_type"]
        }
        Insert: {
          body: string
          created_at?: string
          display_name: string
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          nesting_level?: number
          parent_comment_id?: string | null
          parent_source_comment_id?: string | null
          post_id: string
          score?: number | null
          sort_order?: number
          source_comment_id?: string | null
          source_created_at?: string | null
          source_type?: Database["public"]["Enums"]["comment_source_type"]
        }
        Update: {
          body?: string
          created_at?: string
          display_name?: string
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          nesting_level?: number
          parent_comment_id?: string | null
          parent_source_comment_id?: string | null
          post_id?: string
          score?: number | null
          sort_order?: number
          source_comment_id?: string | null
          source_created_at?: string | null
          source_type?: Database["public"]["Enums"]["comment_source_type"]
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string | null
          event_time: string | null
          id: string
          is_approved: boolean | null
          location: string | null
          submitter_email: string | null
          submitter_name: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          id?: string
          is_approved?: boolean | null
          location?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          id?: string
          is_approved?: boolean | null
          location?: string | null
          submitter_email?: string | null
          submitter_name?: string | null
          title?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          id: string
          is_handled: boolean | null
          message: string
          name: string | null
          phone: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_handled?: boolean | null
          message: string
          name?: string | null
          phone?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_handled?: boolean | null
          message?: string
          name?: string | null
          phone?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      ghost_personas: {
        Row: {
          active: boolean
          bias: number
          created_at: string
          frequency: number
          handle: string
          id: string
          size_max: number
          size_min: number
        }
        Insert: {
          active?: boolean
          bias?: number
          created_at?: string
          frequency?: number
          handle: string
          id?: string
          size_max?: number
          size_min?: number
        }
        Update: {
          active?: boolean
          bias?: number
          created_at?: string
          frequency?: number
          handle?: string
          id?: string
          size_max?: number
          size_min?: number
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          label: string | null
          size_bytes: number | null
          source_filename: string | null
          status: string
          total_comments: number
          total_media: number
          total_posts: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          label?: string | null
          size_bytes?: number | null
          source_filename?: string | null
          status?: string
          total_comments?: number
          total_media?: number
          total_posts?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          label?: string | null
          size_bytes?: number | null
          source_filename?: string | null
          status?: string
          total_comments?: number
          total_media?: number
          total_posts?: number
          updated_at?: string
        }
        Relationships: []
      }
      license_download_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          license_id: string
          release_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          license_id: string
          release_id?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          license_id?: string
          release_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_download_tokens_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_download_tokens_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "platform_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          channel: string
          created_at: string
          current_version: string | null
          downloads_max: number
          downloads_used: number
          email: string
          id: string
          last_check_at: string | null
          license_key: string
          purchase_id: string | null
          revoked: boolean
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          current_version?: string | null
          downloads_max?: number
          downloads_used?: number
          email: string
          id?: string
          last_check_at?: string | null
          license_key: string
          purchase_id?: string | null
          revoked?: boolean
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          current_version?: string | null
          downloads_max?: number
          downloads_used?: number
          email?: string
          id?: string
          last_check_at?: string | null
          license_key?: string
          purchase_id?: string | null
          revoked?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "network_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      managed_site_release_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          notes: string | null
          release_id: string
          site_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          notes?: string | null
          release_id: string
          site_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
          release_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "managed_site_release_events_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "platform_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managed_site_release_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "managed_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      managed_sites: {
        Row: {
          auto_apply_security: boolean
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          current_release_id: string | null
          custom_domain: string | null
          custom_domain_last_checked_at: string | null
          custom_domain_last_error: string | null
          custom_domain_status: string
          custom_domain_verified_at: string | null
          custom_domain_verify_token: string | null
          directory_city: string | null
          directory_logo_url: string | null
          directory_opt_in: boolean
          directory_region: string | null
          directory_tagline: string | null
          directory_website_url: string | null
          display_name: string
          id: string
          last_deployed_at: string | null
          latitude: number | null
          longitude: number | null
          network_sync_enabled: boolean
          notes: string | null
          onboarding_completed_at: string | null
          owner_email: string
          owner_user_id: string | null
          pending_release_id: string | null
          provision_error: string | null
          provision_started_at: string | null
          provision_state: string
          provisioned_at: string | null
          purchase_id: string | null
          status: string
          stripe_subscription_id: string | null
          subdomain: string
          subscription_status: string
          supabase_access_token_enc: string | null
          supabase_access_token_expires_at: string | null
          supabase_access_token_iv: string | null
          supabase_anon_key_enc: string | null
          supabase_anon_key_iv: string | null
          supabase_db_password_enc: string | null
          supabase_db_password_iv: string | null
          supabase_org_id: string | null
          supabase_org_name: string | null
          supabase_project_ref: string | null
          supabase_project_url: string | null
          supabase_refresh_token_enc: string | null
          supabase_refresh_token_iv: string | null
          supabase_service_key_enc: string | null
          supabase_service_key_iv: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          auto_apply_security?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          current_release_id?: string | null
          custom_domain?: string | null
          custom_domain_last_checked_at?: string | null
          custom_domain_last_error?: string | null
          custom_domain_status?: string
          custom_domain_verified_at?: string | null
          custom_domain_verify_token?: string | null
          directory_city?: string | null
          directory_logo_url?: string | null
          directory_opt_in?: boolean
          directory_region?: string | null
          directory_tagline?: string | null
          directory_website_url?: string | null
          display_name?: string
          id?: string
          last_deployed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          network_sync_enabled?: boolean
          notes?: string | null
          onboarding_completed_at?: string | null
          owner_email: string
          owner_user_id?: string | null
          pending_release_id?: string | null
          provision_error?: string | null
          provision_started_at?: string | null
          provision_state?: string
          provisioned_at?: string | null
          purchase_id?: string | null
          status?: string
          stripe_subscription_id?: string | null
          subdomain: string
          subscription_status?: string
          supabase_access_token_enc?: string | null
          supabase_access_token_expires_at?: string | null
          supabase_access_token_iv?: string | null
          supabase_anon_key_enc?: string | null
          supabase_anon_key_iv?: string | null
          supabase_db_password_enc?: string | null
          supabase_db_password_iv?: string | null
          supabase_org_id?: string | null
          supabase_org_name?: string | null
          supabase_project_ref?: string | null
          supabase_project_url?: string | null
          supabase_refresh_token_enc?: string | null
          supabase_refresh_token_iv?: string | null
          supabase_service_key_enc?: string | null
          supabase_service_key_iv?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          auto_apply_security?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          current_release_id?: string | null
          custom_domain?: string | null
          custom_domain_last_checked_at?: string | null
          custom_domain_last_error?: string | null
          custom_domain_status?: string
          custom_domain_verified_at?: string | null
          custom_domain_verify_token?: string | null
          directory_city?: string | null
          directory_logo_url?: string | null
          directory_opt_in?: boolean
          directory_region?: string | null
          directory_tagline?: string | null
          directory_website_url?: string | null
          display_name?: string
          id?: string
          last_deployed_at?: string | null
          latitude?: number | null
          longitude?: number | null
          network_sync_enabled?: boolean
          notes?: string | null
          onboarding_completed_at?: string | null
          owner_email?: string
          owner_user_id?: string | null
          pending_release_id?: string | null
          provision_error?: string | null
          provision_started_at?: string | null
          provision_state?: string
          provisioned_at?: string | null
          purchase_id?: string | null
          status?: string
          stripe_subscription_id?: string | null
          subdomain?: string
          subscription_status?: string
          supabase_access_token_enc?: string | null
          supabase_access_token_expires_at?: string | null
          supabase_access_token_iv?: string | null
          supabase_anon_key_enc?: string | null
          supabase_anon_key_iv?: string | null
          supabase_db_password_enc?: string | null
          supabase_db_password_iv?: string | null
          supabase_org_id?: string | null
          supabase_org_name?: string | null
          supabase_project_ref?: string | null
          supabase_project_url?: string | null
          supabase_refresh_token_enc?: string | null
          supabase_refresh_token_iv?: string | null
          supabase_service_key_enc?: string | null
          supabase_service_key_iv?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "managed_sites_current_release_id_fkey"
            columns: ["current_release_id"]
            isOneToOne: false
            referencedRelation: "platform_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managed_sites_pending_release_id_fkey"
            columns: ["pending_release_id"]
            isOneToOne: false
            referencedRelation: "platform_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managed_sites_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "network_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          created_at: string
          credit: string | null
          filename: string | null
          height: number | null
          id: string
          mime_type: string | null
          storage_path: string | null
          uploaded_by: string | null
          url: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          credit?: string | null
          filename?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
          url: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          credit?: string | null
          filename?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
          url?: string
          width?: number | null
        }
        Relationships: []
      }
      merch_orders: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          email: string
          environment: string
          error: string | null
          id: string
          items: Json
          printful_order_id: string | null
          shipping_address: Json | null
          status: string
          stripe_customer_id: string | null
          stripe_session_id: string
          tracking_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          email: string
          environment?: string
          error?: string | null
          id?: string
          items?: Json
          printful_order_id?: string | null
          shipping_address?: Json | null
          status?: string
          stripe_customer_id?: string | null
          stripe_session_id: string
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          email?: string
          environment?: string
          error?: string | null
          id?: string
          items?: Json
          printful_order_id?: string | null
          shipping_address?: Json | null
          status?: string
          stripe_customer_id?: string | null
          stripe_session_id?: string
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      network_purchases: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          email: string
          environment: string
          id: string
          metadata: Json
          status: string
          stripe_customer_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          email: string
          environment?: string
          id?: string
          metadata?: Json
          status?: string
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          email?: string
          environment?: string
          id?: string
          metadata?: Json
          status?: string
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      news_tips: {
        Row: {
          allow_contact: boolean | null
          category: string | null
          created_at: string
          details: string | null
          email: string | null
          id: string
          is_read: boolean | null
          location: string | null
          name: string | null
          phone: string | null
          summary: string
        }
        Insert: {
          allow_contact?: boolean | null
          category?: string | null
          created_at?: string
          details?: string | null
          email?: string | null
          id?: string
          is_read?: boolean | null
          location?: string | null
          name?: string | null
          phone?: string | null
          summary: string
        }
        Update: {
          allow_contact?: boolean | null
          category?: string | null
          created_at?: string
          details?: string | null
          email?: string | null
          id?: string
          is_read?: boolean | null
          location?: string | null
          name?: string | null
          phone?: string | null
          summary?: string
        }
        Relationships: []
      }
      newsletters: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          preferences: Json | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          preferences?: Json | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          preferences?: Json | null
        }
        Relationships: []
      }
      platform_releases: {
        Row: {
          breaking: boolean
          changelog_md: string
          channel: string
          created_at: string
          id: string
          published_at: string | null
          security: boolean
          title: string
          updated_at: string
          version: string
          zip_bytes: number | null
          zip_path: string | null
          zip_sha256: string | null
        }
        Insert: {
          breaking?: boolean
          changelog_md?: string
          channel?: string
          created_at?: string
          id?: string
          published_at?: string | null
          security?: boolean
          title: string
          updated_at?: string
          version: string
          zip_bytes?: number | null
          zip_path?: string | null
          zip_sha256?: string | null
        }
        Update: {
          breaking?: boolean
          changelog_md?: string
          channel?: string
          created_at?: string
          id?: string
          published_at?: string | null
          security?: boolean
          title?: string
          updated_at?: string
          version?: string
          zip_bytes?: number | null
          zip_path?: string | null
          zip_sha256?: string | null
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      post_versions: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          post_id: string
          title: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          post_id: string
          title?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          post_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_versions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          body: string | null
          candidate_hero_image_url: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          dek: string | null
          editor_notes: string | null
          featured_image: string | null
          generated_version: string | null
          hero_caption: string | null
          hero_crop_hint: string | null
          hero_image_alt: string | null
          hero_image_decision: string | null
          hero_image_reason: string | null
          id: string
          is_breaking: boolean
          is_controversial: boolean
          is_pinned: boolean
          is_weather_alert: boolean
          og_image: string | null
          original_flair: string | null
          original_permalink: string | null
          original_source_body: string | null
          original_source_title: string | null
          published_at: string | null
          reddit_comment_error: string | null
          reddit_comment_posted_at: string | null
          reddit_comment_url: string | null
          reddit_import_id: string | null
          related_post_ids: string[] | null
          removed_snapshot: Json | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          source_post_id: string | null
          source_subreddit: string | null
          source_type: Database["public"]["Enums"]["post_source_type"]
          source_url: string | null
          status: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at: string
          verification_notes: string | null
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          candidate_hero_image_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          dek?: string | null
          editor_notes?: string | null
          featured_image?: string | null
          generated_version?: string | null
          hero_caption?: string | null
          hero_crop_hint?: string | null
          hero_image_alt?: string | null
          hero_image_decision?: string | null
          hero_image_reason?: string | null
          id?: string
          is_breaking?: boolean
          is_controversial?: boolean
          is_pinned?: boolean
          is_weather_alert?: boolean
          og_image?: string | null
          original_flair?: string | null
          original_permalink?: string | null
          original_source_body?: string | null
          original_source_title?: string | null
          published_at?: string | null
          reddit_comment_error?: string | null
          reddit_comment_posted_at?: string | null
          reddit_comment_url?: string | null
          reddit_import_id?: string | null
          related_post_ids?: string[] | null
          removed_snapshot?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          source_post_id?: string | null
          source_subreddit?: string | null
          source_type?: Database["public"]["Enums"]["post_source_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at?: string
          verification_notes?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string | null
          candidate_hero_image_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          dek?: string | null
          editor_notes?: string | null
          featured_image?: string | null
          generated_version?: string | null
          hero_caption?: string | null
          hero_crop_hint?: string | null
          hero_image_alt?: string | null
          hero_image_decision?: string | null
          hero_image_reason?: string | null
          id?: string
          is_breaking?: boolean
          is_controversial?: boolean
          is_pinned?: boolean
          is_weather_alert?: boolean
          og_image?: string | null
          original_flair?: string | null
          original_permalink?: string | null
          original_source_body?: string | null
          original_source_title?: string | null
          published_at?: string | null
          reddit_comment_error?: string | null
          reddit_comment_posted_at?: string | null
          reddit_comment_url?: string | null
          reddit_import_id?: string | null
          related_post_ids?: string[] | null
          removed_snapshot?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          source_post_id?: string | null
          source_subreddit?: string | null
          source_type?: Database["public"]["Enums"]["post_source_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          updated_at?: string
          verification_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_reddit_import_fk"
            columns: ["reddit_import_id"]
            isOneToOne: false
            referencedRelation: "reddit_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reddit_automation_settings: {
        Row: {
          created_at: string
          enabled: boolean
          github_workflow_ref: string
          id: boolean
          mode: string
          rate_per_day: number
          rate_per_hour: number
          reddit_password_encrypted: string | null
          reddit_password_iv: string | null
          reddit_username: string | null
          session_captured_at: string | null
          session_cookies_encrypted: string | null
          session_cookies_iv: string | null
          session_last_error: string | null
          session_status: string | null
          template_markdown: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          github_workflow_ref?: string
          id?: boolean
          mode?: string
          rate_per_day?: number
          rate_per_hour?: number
          reddit_password_encrypted?: string | null
          reddit_password_iv?: string | null
          reddit_username?: string | null
          session_captured_at?: string | null
          session_cookies_encrypted?: string | null
          session_cookies_iv?: string | null
          session_last_error?: string | null
          session_status?: string | null
          template_markdown?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          github_workflow_ref?: string
          id?: boolean
          mode?: string
          rate_per_day?: number
          rate_per_hour?: number
          reddit_password_encrypted?: string | null
          reddit_password_iv?: string | null
          reddit_username?: string | null
          session_captured_at?: string | null
          session_cookies_encrypted?: string | null
          session_cookies_iv?: string | null
          session_last_error?: string | null
          session_status?: string | null
          template_markdown?: string
          updated_at?: string
        }
        Relationships: []
      }
      reddit_comment_attempts: {
        Row: {
          attempt_no: number
          created_at: string
          finished_at: string | null
          github_run_id: string | null
          github_run_url: string | null
          id: string
          log_excerpt: string | null
          notification_id: string
          screenshot_path: string | null
          started_at: string
          status: string
        }
        Insert: {
          attempt_no: number
          created_at?: string
          finished_at?: string | null
          github_run_id?: string | null
          github_run_url?: string | null
          id?: string
          log_excerpt?: string | null
          notification_id: string
          screenshot_path?: string | null
          started_at?: string
          status: string
        }
        Update: {
          attempt_no?: number
          created_at?: string
          finished_at?: string | null
          github_run_id?: string | null
          github_run_url?: string | null
          id?: string
          log_excerpt?: string | null
          notification_id?: string
          screenshot_path?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reddit_comment_attempts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "reddit_comment_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_comment_notifications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attempt_count: number
          created_at: string
          dispatched_at: string | null
          failure_reason: string | null
          id: string
          mode_at_enqueue: string
          post_id: string
          posted_at: string | null
          reddit_comment_id: string | null
          reddit_comment_permalink: string | null
          reddit_import_id: string | null
          rendered_comment: string
          status: string
          subreddit: string | null
          thread_id: string | null
          thread_url: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attempt_count?: number
          created_at?: string
          dispatched_at?: string | null
          failure_reason?: string | null
          id?: string
          mode_at_enqueue: string
          post_id: string
          posted_at?: string | null
          reddit_comment_id?: string | null
          reddit_comment_permalink?: string | null
          reddit_import_id?: string | null
          rendered_comment: string
          status?: string
          subreddit?: string | null
          thread_id?: string | null
          thread_url: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attempt_count?: number
          created_at?: string
          dispatched_at?: string | null
          failure_reason?: string | null
          id?: string
          mode_at_enqueue?: string
          post_id?: string
          posted_at?: string | null
          reddit_comment_id?: string | null
          reddit_comment_permalink?: string | null
          reddit_import_id?: string | null
          rendered_comment?: string
          status?: string
          subreddit?: string | null
          thread_id?: string | null
          thread_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reddit_comment_notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reddit_comment_notifications_reddit_import_id_fkey"
            columns: ["reddit_import_id"]
            isOneToOne: false
            referencedRelation: "reddit_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_import_comments: {
        Row: {
          body: string | null
          created_at: string
          display_name: string | null
          id: string
          nesting_level: number
          parent_source_comment_id: string | null
          reddit_import_id: string
          score: number | null
          source_comment_id: string | null
          source_created_at: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          nesting_level?: number
          parent_source_comment_id?: string | null
          reddit_import_id: string
          score?: number | null
          source_comment_id?: string | null
          source_created_at?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          nesting_level?: number
          parent_source_comment_id?: string | null
          reddit_import_id?: string
          score?: number | null
          source_comment_id?: string | null
          source_created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reddit_import_comments_reddit_import_id_fkey"
            columns: ["reddit_import_id"]
            isOneToOne: false
            referencedRelation: "reddit_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_imports: {
        Row: {
          batch_id: string | null
          candidate_hero_image_url: string | null
          created_at: string
          created_by: string | null
          current_score: number | null
          generated_post_id: string | null
          id: string
          import_status: Database["public"]["Enums"]["import_status"]
          link_flair_text: string | null
          media_paths: string[]
          moderation_reasons: Json
          moderation_status: string
          original_author_display: string | null
          original_body: string | null
          original_created_at: string | null
          original_title: string | null
          parsed_comments: Json | null
          permalink: string | null
          processing_error: string | null
          raw_comment_text: string | null
          reddit_post_id: string | null
          source_score: number | null
          source_url: string | null
          subreddit: string | null
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          candidate_hero_image_url?: string | null
          created_at?: string
          created_by?: string | null
          current_score?: number | null
          generated_post_id?: string | null
          id?: string
          import_status?: Database["public"]["Enums"]["import_status"]
          link_flair_text?: string | null
          media_paths?: string[]
          moderation_reasons?: Json
          moderation_status?: string
          original_author_display?: string | null
          original_body?: string | null
          original_created_at?: string | null
          original_title?: string | null
          parsed_comments?: Json | null
          permalink?: string | null
          processing_error?: string | null
          raw_comment_text?: string | null
          reddit_post_id?: string | null
          source_score?: number | null
          source_url?: string | null
          subreddit?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          candidate_hero_image_url?: string | null
          created_at?: string
          created_by?: string | null
          current_score?: number | null
          generated_post_id?: string | null
          id?: string
          import_status?: Database["public"]["Enums"]["import_status"]
          link_flair_text?: string | null
          media_paths?: string[]
          moderation_reasons?: Json
          moderation_status?: string
          original_author_display?: string | null
          original_body?: string | null
          original_created_at?: string | null
          original_title?: string | null
          parsed_comments?: Json | null
          permalink?: string | null
          processing_error?: string | null
          raw_comment_text?: string | null
          reddit_post_id?: string | null
          source_score?: number | null
          source_url?: string | null
          subreddit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reddit_imports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reddit_imports_generated_post_id_fkey"
            columns: ["generated_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_listing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          github_run_url: string | null
          id: string
          imported_count: number | null
          limit_per_sub: number
          posts_count: number | null
          sort: string
          status: string
          subreddit: string
          top_window: string | null
          triggered_by: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          github_run_url?: string | null
          id?: string
          imported_count?: number | null
          limit_per_sub?: number
          posts_count?: number | null
          sort?: string
          status?: string
          subreddit: string
          top_window?: string | null
          triggered_by?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          github_run_url?: string | null
          id?: string
          imported_count?: number | null
          limit_per_sub?: number
          posts_count?: number | null
          sort?: string
          status?: string
          subreddit?: string
          top_window?: string | null
          triggered_by?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      supabase_oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          redirect_after: string | null
          site_id: string | null
          state: string
          user_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at?: string
          redirect_after?: string | null
          site_id?: string | null
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          redirect_after?: string | null
          site_id?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supabase_oauth_states_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "managed_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      tenant_admin_login_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          requested_ip: string | null
          site_id: string | null
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          requested_ip?: string | null
          site_id?: string | null
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          requested_ip?: string | null
          site_id?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_admin_login_tokens_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "managed_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_admin_sessions: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          last_seen_at: string
          revoked_at: string | null
          session_hash: string
          site_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_hash: string
          site_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_hash?: string
          site_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_admin_sessions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "managed_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_hidden_network_posts: {
        Row: {
          hidden_at: string
          hidden_by: string | null
          post_id: string
          site_id: string
        }
        Insert: {
          hidden_at?: string
          hidden_by?: string | null
          post_id: string
          site_id: string
        }
        Update: {
          hidden_at?: string
          hidden_by?: string | null
          post_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_hidden_network_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_hidden_network_posts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "managed_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_provision_attempts: {
        Row: {
          attempted_project_name: string
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          session_code: string
          site_id: string
          started_at: string
          status: string
          supabase_org_id: string
          supabase_project_ref: string | null
          updated_at: string
        }
        Insert: {
          attempted_project_name: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          session_code: string
          site_id: string
          started_at?: string
          status?: string
          supabase_org_id: string
          supabase_project_ref?: string | null
          updated_at?: string
        }
        Update: {
          attempted_project_name?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          session_code?: string
          site_id?: string
          started_at?: string
          status?: string
          supabase_org_id?: string
          supabase_project_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_provision_attempts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "managed_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verdict_abuse_flags: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          reason: string
          resolved: boolean
          wallet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          reason: string
          resolved?: boolean
          wallet_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          reason?: string
          resolved?: boolean
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verdict_abuse_flags_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "verdict_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      verdict_battles: {
        Row: {
          created_at: string
          current_lead_side: string | null
          decided_at: string | null
          ends_at: string
          ghost_mode: string
          id: string
          keep_credits: number
          lead_since: string | null
          lead_threshold: number
          momentum_window_sec: number
          opened_at: string
          participant_count: number
          post_id: string
          remove_credits: number
          status: string
          updated_at: string
          winner: string | null
        }
        Insert: {
          created_at?: string
          current_lead_side?: string | null
          decided_at?: string | null
          ends_at?: string
          ghost_mode?: string
          id?: string
          keep_credits?: number
          lead_since?: string | null
          lead_threshold?: number
          momentum_window_sec?: number
          opened_at?: string
          participant_count?: number
          post_id: string
          remove_credits?: number
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Update: {
          created_at?: string
          current_lead_side?: string | null
          decided_at?: string | null
          ends_at?: string
          ghost_mode?: string
          id?: string
          keep_credits?: number
          lead_since?: string | null
          lead_threshold?: number
          momentum_window_sec?: number
          opened_at?: string
          participant_count?: number
          post_id?: string
          remove_credits?: number
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verdict_battles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      verdict_credit_packs: {
        Row: {
          amount_cents: number
          created_at: string
          credits_granted: number
          currency: string
          environment: string | null
          id: string
          pack_id: string
          status: string
          stripe_session_id: string | null
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credits_granted: number
          currency?: string
          environment?: string | null
          id?: string
          pack_id: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credits_granted?: number
          currency?: string
          environment?: string | null
          id?: string
          pack_id?: string
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verdict_credit_packs_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "verdict_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      verdict_rate_windows: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      verdict_votes: {
        Row: {
          battle_id: string
          cost_charged: number
          created_at: string
          credits: number
          dividend_paid: number
          fingerprint_hash: string | null
          ghost_handle: string | null
          id: string
          ip_hash: string | null
          is_ghost: boolean
          side: string
          vote_n: number
          wallet_id: string | null
        }
        Insert: {
          battle_id: string
          cost_charged: number
          created_at?: string
          credits: number
          dividend_paid?: number
          fingerprint_hash?: string | null
          ghost_handle?: string | null
          id?: string
          ip_hash?: string | null
          is_ghost?: boolean
          side: string
          vote_n: number
          wallet_id?: string | null
        }
        Update: {
          battle_id?: string
          cost_charged?: number
          created_at?: string
          credits?: number
          dividend_paid?: number
          fingerprint_hash?: string | null
          ghost_handle?: string | null
          id?: string
          ip_hash?: string | null
          is_ghost?: boolean
          side?: string
          vote_n?: number
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verdict_votes_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "verdict_battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verdict_votes_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "verdict_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      verdict_wallets: {
        Row: {
          balance: number
          created_at: string
          fingerprint_hash: string
          id: string
          last_daily_claim_at: string | null
          lifetime_earned: number
          lifetime_purchased: number
          quarantined: boolean
          updated_at: string
          verified_email: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          fingerprint_hash: string
          id?: string
          last_daily_claim_at?: string | null
          lifetime_earned?: number
          lifetime_purchased?: number
          quarantined?: boolean
          updated_at?: string
          verified_email?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          fingerprint_hash?: string
          id?: string
          last_daily_claim_at?: string | null
          lifetime_earned?: number
          lifetime_purchased?: number
          quarantined?: boolean
          updated_at?: string
          verified_email?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_battle_state: {
        Args: { _post_id: string }
        Returns: {
          battle_id: string
          current_lead_side: string
          decided_at: string
          ends_at: string
          keep_credits: number
          lead_since: string
          lead_threshold: number
          momentum_window_sec: number
          opened_at: string
          participant_count: number
          remove_credits: number
          status: string
          winner: string
        }[]
      }
      get_battle_ticker: {
        Args: { _battle_id: string; _limit?: number }
        Returns: {
          created_at: string
          credits: number
          is_ghost: boolean
          label: string
          side: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      list_public_affiliate_stations: {
        Args: never
        Returns: {
          city: string
          display_name: string
          kind: string
          logo_url: string
          region: string
          since: string
          tagline: string
          website_url: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
      closing_status:
        | "closed"
        | "delayed"
        | "early_dismissal"
        | "virtual"
        | "normal"
      closing_type: "school" | "government" | "business" | "other"
      comment_source_type: "reddit" | "public" | "staff"
      import_status: "new" | "parsed" | "generated" | "published" | "discarded"
      moderation_status: "pending" | "approved" | "hidden" | "removed"
      post_source_type:
        | "original"
        | "reddit_import"
        | "manual_import"
        | "wire_style"
        | "community_tip"
      post_status:
        | "draft"
        | "review"
        | "published"
        | "archived"
        | "community_removed"
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
    Enums: {
      app_role: ["admin", "editor", "user"],
      closing_status: [
        "closed",
        "delayed",
        "early_dismissal",
        "virtual",
        "normal",
      ],
      closing_type: ["school", "government", "business", "other"],
      comment_source_type: ["reddit", "public", "staff"],
      import_status: ["new", "parsed", "generated", "published", "discarded"],
      moderation_status: ["pending", "approved", "hidden", "removed"],
      post_source_type: [
        "original",
        "reddit_import",
        "manual_import",
        "wire_style",
        "community_tip",
      ],
      post_status: [
        "draft",
        "review",
        "published",
        "archived",
        "community_removed",
      ],
    },
  },
} as const
