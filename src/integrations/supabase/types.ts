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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_payment_info: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          id: string
          instructions: string | null
          price_annual: string | null
          price_lifetime: string | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          id?: string
          instructions?: string | null
          price_annual?: string | null
          price_lifetime?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          id?: string
          instructions?: string | null
          price_annual?: string | null
          price_lifetime?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      anime_download_tracker: {
        Row: {
          airing_status: string | null
          anilist_id: number
          cover_image: string | null
          created_at: string
          genres: string[] | null
          id: string
          status: string
          title: string
          total_episodes: number | null
          updated_at: string
        }
        Insert: {
          airing_status?: string | null
          anilist_id: number
          cover_image?: string | null
          created_at?: string
          genres?: string[] | null
          id?: string
          status?: string
          title: string
          total_episodes?: number | null
          updated_at?: string
        }
        Update: {
          airing_status?: string | null
          anilist_id?: number
          cover_image?: string | null
          created_at?: string
          genres?: string[] | null
          id?: string
          status?: string
          title?: string
          total_episodes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      anime_episode_downloads: {
        Row: {
          created_at: string
          downloaded: boolean | null
          episode_number: number
          id: string
          tracker_id: string
        }
        Insert: {
          created_at?: string
          downloaded?: boolean | null
          episode_number: number
          id?: string
          tracker_id: string
        }
        Update: {
          created_at?: string
          downloaded?: boolean | null
          episode_number?: number
          id?: string
          tracker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anime_episode_downloads_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "anime_download_tracker"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_lists: {
        Row: {
          anime_cover: string | null
          anime_id: number
          anime_title: string | null
          created_at: string
          id: string
          list_type: Database["public"]["Enums"]["anime_list_type"]
          user_id: string
        }
        Insert: {
          anime_cover?: string | null
          anime_id: number
          anime_title?: string | null
          created_at?: string
          id?: string
          list_type: Database["public"]["Enums"]["anime_list_type"]
          user_id: string
        }
        Update: {
          anime_cover?: string | null
          anime_id?: number
          anime_title?: string | null
          created_at?: string
          id?: string
          list_type?: Database["public"]["Enums"]["anime_list_type"]
          user_id?: string
        }
        Relationships: []
      }
      anime_views: {
        Row: {
          anilist_id: number
          id: string
          updated_at: string
          view_count: number
        }
        Insert: {
          anilist_id: number
          id?: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          anilist_id?: number
          id?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      broken_link_reports: {
        Row: {
          anilist_id: number | null
          anime_cover: string | null
          anime_title: string | null
          created_at: string
          episode_number: number | null
          first_reported_at: string
          id: string
          last_reported_at: string
          report_count: number
          report_type: string
          resolved_at: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          anilist_id?: number | null
          anime_cover?: string | null
          anime_title?: string | null
          created_at?: string
          episode_number?: number | null
          first_reported_at?: string
          id?: string
          last_reported_at?: string
          report_count?: number
          report_type?: string
          resolved_at?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          anilist_id?: number | null
          anime_cover?: string | null
          anime_title?: string | null
          created_at?: string
          episode_number?: number | null
          first_reported_at?: string
          id?: string
          last_reported_at?: string
          report_count?: number
          report_type?: string
          resolved_at?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_links: {
        Row: {
          color: string | null
          created_at: string
          icon_url: string | null
          id: string
          name: string
          sort_order: number | null
          url: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          sort_order?: number | null
          url: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          url?: string
        }
        Relationships: []
      }
      hidden_home_animes: {
        Row: {
          anilist_id: number
          anime_title: string | null
          created_at: string
          hidden_by: string | null
          id: string
          reason: string | null
        }
        Insert: {
          anilist_id: number
          anime_title?: string | null
          created_at?: string
          hidden_by?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          anilist_id?: number
          anime_title?: string | null
          created_at?: string
          hidden_by?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      latino_episodes: {
        Row: {
          created_at: string
          episode_number: number
          id: string
          slug: string
          sources: Json
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          episode_number: number
          id?: string
          slug: string
          sources?: Json
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          episode_number?: number
          id?: string
          slug?: string
          sources?: Json
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      notification_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          notification_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          notification_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dismissals_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          active: boolean | null
          created_at: string
          created_by: string | null
          id: string
          message: string
          title: string
          type: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          title: string
          type?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      premium_memberships: {
        Row: {
          activated_at: string | null
          activation_key: string | null
          created_at: string
          expires_at: string | null
          id: string
          membership_type: Database["public"]["Enums"]["membership_type"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          activation_key?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_type: Database["public"]["Enums"]["membership_type"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          activation_key?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_type?: Database["public"]["Enums"]["membership_type"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      premium_requests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          membership_type: Database["public"]["Enums"]["membership_type"]
          notes: string | null
          proof_url: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          membership_type: Database["public"]["Enums"]["membership_type"]
          notes?: string | null
          proof_url?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          membership_type?: Database["public"]["Enums"]["membership_type"]
          notes?: string | null
          proof_url?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_seen_notification_id: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen_notification_id?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen_notification_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      slug_cache: {
        Row: {
          anilist_id: number
          created_at: string
          id: string
          slug: string
          title: string | null
        }
        Insert: {
          anilist_id: number
          created_at?: string
          id?: string
          slug: string
          title?: string | null
        }
        Update: {
          anilist_id?: number
          created_at?: string
          id?: string
          slug?: string
          title?: string | null
        }
        Relationships: []
      }
      slug_overrides: {
        Row: {
          anilist_id: number
          anime_title: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          id: string
          manual_slug: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          anilist_id: number
          anime_title?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manual_slug: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          anime_title?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          manual_slug?: string
          notes?: string | null
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      video_cache: {
        Row: {
          anilist_id: number | null
          anime_title: string | null
          created_at: string
          episode: number
          id: string
          lang: string
          slug: string
          sources: Json
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          anilist_id?: number | null
          anime_title?: string | null
          created_at?: string
          episode: number
          id?: string
          lang?: string
          slug: string
          sources?: Json
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          anilist_id?: number | null
          anime_title?: string | null
          created_at?: string
          episode?: number
          id?: string
          lang?: string
          slug?: string
          sources?: Json
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          anime_cover: string | null
          anime_id: number
          anime_title: string | null
          completed: boolean | null
          created_at: string
          current_time_seconds: number | null
          episode_number: number
          id: string
          progress_percent: number | null
          total_duration_seconds: number | null
          user_id: string
          watch_duration_seconds: number | null
        }
        Insert: {
          anime_cover?: string | null
          anime_id: number
          anime_title?: string | null
          completed?: boolean | null
          created_at?: string
          current_time_seconds?: number | null
          episode_number: number
          id?: string
          progress_percent?: number | null
          total_duration_seconds?: number | null
          user_id: string
          watch_duration_seconds?: number | null
        }
        Update: {
          anime_cover?: string | null
          anime_id?: number
          anime_title?: string | null
          completed?: boolean | null
          created_at?: string
          current_time_seconds?: number | null
          episode_number?: number
          id?: string
          progress_percent?: number | null
          total_duration_seconds?: number | null
          user_id?: string
          watch_duration_seconds?: number | null
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
      increment_anime_view: { Args: { _anilist_id: number }; Returns: number }
    }
    Enums: {
      anime_list_type:
        | "favorite"
        | "watching"
        | "completed"
        | "plan_to_watch"
        | "undecided"
      app_role: "owner" | "admin" | "premium" | "user"
      membership_status: "pending" | "active" | "expired" | "rejected"
      membership_type: "annual" | "lifetime"
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
      anime_list_type: [
        "favorite",
        "watching",
        "completed",
        "plan_to_watch",
        "undecided",
      ],
      app_role: ["owner", "admin", "premium", "user"],
      membership_status: ["pending", "active", "expired", "rejected"],
      membership_type: ["annual", "lifetime"],
    },
  },
} as const
