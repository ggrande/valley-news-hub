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
