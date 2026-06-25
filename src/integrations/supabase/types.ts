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
          created_at: string
          current_release_id: string | null
          custom_domain: string | null
          display_name: string
          id: string
          last_deployed_at: string | null
          notes: string | null
          owner_email: string
          owner_user_id: string | null
          pending_release_id: string | null
          purchase_id: string | null
          status: string
          stripe_subscription_id: string | null
          subdomain: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          auto_apply_security?: boolean
          created_at?: string
          current_release_id?: string | null
          custom_domain?: string | null
          display_name?: string
          id?: string
          last_deployed_at?: string | null
          notes?: string | null
          owner_email: string
          owner_user_id?: string | null
          pending_release_id?: string | null
          purchase_id?: string | null
          status?: string
          stripe_subscription_id?: string | null
          subdomain: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          auto_apply_security?: boolean
          created_at?: string
          current_release_id?: string | null
          custom_domain?: string | null
          display_name?: string
          id?: string
          last_deployed_at?: string | null
          notes?: string | null
          owner_email?: string
          owner_user_id?: string | null
          pending_release_id?: string | null
          purchase_id?: string | null
          status?: string
          stripe_subscription_id?: string | null
          subdomain?: string
          subscription_status?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
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
      post_status: "draft" | "review" | "published" | "archived"
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
      post_status: ["draft", "review", "published", "archived"],
    },
  },
} as const
