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
      account_profiles: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          created_at: string
          font_family: string | null
          id: string
          is_default: boolean
          name: string
          pin_enabled: boolean
          pin_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          is_default?: boolean
          name: string
          pin_enabled?: boolean
          pin_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          created_at?: string
          font_family?: string | null
          id?: string
          is_default?: boolean
          name?: string
          pin_enabled?: boolean
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          condition_type: string
          condition_value: number
          created_at: string
          description: string
          icon: string
          name: string
          rarity: string
          slug: string
          xp_reward: number
        }
        Insert: {
          condition_type: string
          condition_value?: number
          created_at?: string
          description: string
          icon: string
          name: string
          rarity?: string
          slug: string
          xp_reward?: number
        }
        Update: {
          condition_type?: string
          condition_value?: number
          created_at?: string
          description?: string
          icon?: string
          name?: string
          rarity?: string
          slug?: string
          xp_reward?: number
        }
        Relationships: []
      }
      admin_activity_log: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          anilist_id: number | null
          anime_title: string | null
          area: string
          created_at: string
          episode_number: number | null
          id: string
          metadata: Json | null
          summary: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_name?: string | null
          anilist_id?: number | null
          anime_title?: string | null
          area: string
          created_at?: string
          episode_number?: number | null
          id?: string
          metadata?: Json | null
          summary: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          anilist_id?: number | null
          anime_title?: string | null
          area?: string
          created_at?: string
          episode_number?: number | null
          id?: string
          metadata?: Json | null
          summary?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_banners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          name: string
          position: number
          rarity: Database["public"]["Enums"]["cosmetic_rarity"]
          requirement_type: string
          requirement_value: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          name: string
          position?: number
          rarity?: Database["public"]["Enums"]["cosmetic_rarity"]
          requirement_type?: string
          requirement_value?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          position?: number
          rarity?: Database["public"]["Enums"]["cosmetic_rarity"]
          requirement_type?: string
          requirement_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_frames: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string | null
          name: string
          position: number
          rarity: Database["public"]["Enums"]["cosmetic_rarity"]
          requirement_type: string
          requirement_value: number
          shape: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          position?: number
          rarity?: Database["public"]["Enums"]["cosmetic_rarity"]
          requirement_type?: string
          requirement_value?: number
          shape?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          position?: number
          rarity?: Database["public"]["Enums"]["cosmetic_rarity"]
          requirement_type?: string
          requirement_value?: number
          shape?: string
          updated_at?: string
        }
        Relationships: []
      }
      adult_animes: {
        Row: {
          anilist_id: number
          detected_at: string
          title: string | null
        }
        Insert: {
          anilist_id: number
          detected_at?: string
          title?: string | null
        }
        Update: {
          anilist_id?: number
          detected_at?: string
          title?: string | null
        }
        Relationships: []
      }
      anime_download_tracker: {
        Row: {
          added_by: string | null
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
          updated_by: string | null
        }
        Insert: {
          added_by?: string | null
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
          updated_by?: string | null
        }
        Update: {
          added_by?: string | null
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
          updated_by?: string | null
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
      anime_like_counts: {
        Row: {
          anilist_id: number
          like_count: number
          updated_at: string
        }
        Insert: {
          anilist_id: number
          like_count?: number
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          like_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      anime_likes: {
        Row: {
          anilist_id: number
          created_at: string
          user_id: string
        }
        Insert: {
          anilist_id: number
          created_at?: string
          user_id: string
        }
        Update: {
          anilist_id?: number
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      anime_lists: {
        Row: {
          anime_cover: string | null
          anime_id: number
          anime_title: string | null
          created_at: string
          id: string
          list_type: Database["public"]["Enums"]["anime_list_type"]
          profile_id: string | null
          user_id: string
        }
        Insert: {
          anime_cover?: string | null
          anime_id: number
          anime_title?: string | null
          created_at?: string
          id?: string
          list_type: Database["public"]["Enums"]["anime_list_type"]
          profile_id?: string | null
          user_id: string
        }
        Update: {
          anime_cover?: string | null
          anime_id?: number
          anime_title?: string | null
          created_at?: string
          id?: string
          list_type?: Database["public"]["Enums"]["anime_list_type"]
          profile_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      anime_status_overrides: {
        Row: {
          anilist_id: number
          anime_title: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          id: string
          manual_status: string
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
          manual_status: string
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
          manual_status?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      anime_synopsis_es: {
        Row: {
          anilist_id: number
          created_at: string
          source_hash: string
          translated_text: string
          updated_at: string
        }
        Insert: {
          anilist_id: number
          created_at?: string
          source_hash: string
          translated_text: string
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          created_at?: string
          source_hash?: string
          translated_text?: string
          updated_at?: string
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
      approved_animes: {
        Row: {
          anilist_id: number
          approved_by: string | null
          created_at: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          anilist_id: number
          approved_by?: string | null
          created_at?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          approved_by?: string | null
          created_at?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      auto_latest_episodes: {
        Row: {
          anilist_id: number
          anilist_status: string | null
          banner: string | null
          cover: string | null
          created_at: string
          episode_updated_at: string
          last_checked_at: string
          latest_episode: number
          previous_episode: number
          title: string
          updated_at: string
        }
        Insert: {
          anilist_id: number
          anilist_status?: string | null
          banner?: string | null
          cover?: string | null
          created_at?: string
          episode_updated_at?: string
          last_checked_at?: string
          latest_episode?: number
          previous_episode?: number
          title: string
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          anilist_status?: string | null
          banner?: string | null
          cover?: string | null
          created_at?: string
          episode_updated_at?: string
          last_checked_at?: string
          latest_episode?: number
          previous_episode?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      broken_link_reporters: {
        Row: {
          created_at: string
          id: string
          plan_slug: string | null
          priority_label: string | null
          priority_score: number
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_slug?: string | null
          priority_label?: string | null
          priority_score?: number
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_slug?: string | null
          priority_label?: string | null
          priority_score?: number
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broken_link_reporters_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "broken_link_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      broken_link_reports: {
        Row: {
          anilist_id: number | null
          anime_cover: string | null
          anime_title: string | null
          created_at: string
          episode_number: number | null
          first_reported_at: string
          highest_plan_slug: string | null
          highest_priority_label: string | null
          id: string
          last_reported_at: string
          priority_score: number
          reason: string | null
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
          highest_plan_slug?: string | null
          highest_priority_label?: string | null
          id?: string
          last_reported_at?: string
          priority_score?: number
          reason?: string | null
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
          highest_plan_slug?: string | null
          highest_priority_label?: string | null
          id?: string
          last_reported_at?: string
          priority_score?: number
          reason?: string | null
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
      device_sessions: {
        Row: {
          created_at: string
          device_id: string
          device_name: string | null
          id: string
          last_active_at: string
          platform: string | null
          revoked_at: string | null
          session_fingerprint: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_name?: string | null
          id?: string
          last_active_at?: string
          platform?: string | null
          revoked_at?: string | null
          session_fingerprint?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_name?: string | null
          id?: string
          last_active_at?: string
          platform?: string | null
          revoked_at?: string | null
          session_fingerprint?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      episode_count_overrides: {
        Row: {
          anilist_id: number
          anime_title: string | null
          created_at: string
          created_by: string | null
          episode_count: number
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          anilist_id: number
          anime_title?: string | null
          created_at?: string
          created_by?: string | null
          episode_count: number
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          anime_title?: string | null
          created_at?: string
          created_by?: string | null
          episode_count?: number
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gacha_pity: {
        Row: {
          pulls_since_legendary: number
          pulls_since_special: number
          updated_at: string
          user_id: string
        }
        Insert: {
          pulls_since_legendary?: number
          pulls_since_special?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          pulls_since_legendary?: number
          pulls_since_special?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gacha_pulls: {
        Row: {
          created_at: string
          id: string
          pool: string
          reward_rarity: Database["public"]["Enums"]["cosmetic_rarity"]
          reward_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pool: string
          reward_rarity: Database["public"]["Enums"]["cosmetic_rarity"]
          reward_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pool?: string
          reward_rarity?: Database["public"]["Enums"]["cosmetic_rarity"]
          reward_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      hidden_home_animes: {
        Row: {
          anilist_id: number
          anime_title: string | null
          auto_hidden: boolean
          country_of_origin: string | null
          created_at: string
          hidden_by: string | null
          id: string
          is_hidden: boolean
          reason: string | null
          source: string
          tags: Json
        }
        Insert: {
          anilist_id: number
          anime_title?: string | null
          auto_hidden?: boolean
          country_of_origin?: string | null
          created_at?: string
          hidden_by?: string | null
          id?: string
          is_hidden?: boolean
          reason?: string | null
          source?: string
          tags?: Json
        }
        Update: {
          anilist_id?: number
          anime_title?: string | null
          auto_hidden?: boolean
          country_of_origin?: string | null
          created_at?: string
          hidden_by?: string | null
          id?: string
          is_hidden?: boolean
          reason?: string | null
          source?: string
          tags?: Json
        }
        Relationships: []
      }
      hidden_pending_animes: {
        Row: {
          anilist_id: number
          created_at: string
          expires_at: string
          hidden_at: string
          hidden_by: string | null
          id: string
          reason: string | null
        }
        Insert: {
          anilist_id: number
          created_at?: string
          expires_at?: string
          hidden_at?: string
          hidden_by?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          anilist_id?: number
          created_at?: string
          expires_at?: string
          hidden_at?: string
          hidden_by?: string | null
          id?: string
          reason?: string | null
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
          image_url: string | null
          link: string | null
          message: string
          target_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          message: string
          target_user_id?: string | null
          title: string
          type?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string
          target_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      pending_anime_reserve: {
        Row: {
          anilist_id: number
          average_score: number | null
          consumed_at: string | null
          cover_image: string | null
          created_at: string
          english_title: string | null
          episodes: number | null
          format: string | null
          id: string
          last_seen_at: string
          priority: number
          reserve_state: string
          romaji_title: string | null
          source: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          anilist_id: number
          average_score?: number | null
          consumed_at?: string | null
          cover_image?: string | null
          created_at?: string
          english_title?: string | null
          episodes?: number | null
          format?: string | null
          id?: string
          last_seen_at?: string
          priority?: number
          reserve_state?: string
          romaji_title?: string | null
          source?: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          average_score?: number | null
          consumed_at?: string | null
          cover_image?: string | null
          created_at?: string
          english_title?: string | null
          episodes?: number | null
          format?: string | null
          id?: string
          last_seen_at?: string
          priority?: number
          reserve_state?: string
          romaji_title?: string | null
          source?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      premium_plan_configs: {
        Row: {
          accent_color: string
          ads_free: boolean
          badge: string | null
          custom_avatar_upload: boolean
          downloads_allowed: boolean
          enabled: boolean
          inherited_from: string | null
          max_profiles: number
          max_streams: number
          multi_status_selection: boolean
          name: string
          pdf_export: boolean
          price_label: string
          priority_servers: boolean
          priority_support: boolean
          profiles_enabled: boolean
          quality_enabled: boolean
          quality_label: string
          quality_max: string
          show_ads_free: boolean
          show_downloads: boolean
          show_pdf_export: boolean
          show_priority_servers: boolean
          show_priority_support: boolean
          show_profiles: boolean
          show_quality: boolean
          show_streams: boolean
          show_uninterrupted_fullscreen: boolean
          show_vip_support: boolean
          slug: string
          sort_order: number
          streams_enabled: boolean
          uninterrupted_fullscreen: boolean
          updated_at: string
          vip_support: boolean
        }
        Insert: {
          accent_color?: string
          ads_free?: boolean
          badge?: string | null
          custom_avatar_upload?: boolean
          downloads_allowed?: boolean
          enabled?: boolean
          inherited_from?: string | null
          max_profiles?: number
          max_streams?: number
          multi_status_selection?: boolean
          name: string
          pdf_export?: boolean
          price_label: string
          priority_servers?: boolean
          priority_support?: boolean
          profiles_enabled?: boolean
          quality_enabled?: boolean
          quality_label?: string
          quality_max?: string
          show_ads_free?: boolean
          show_downloads?: boolean
          show_pdf_export?: boolean
          show_priority_servers?: boolean
          show_priority_support?: boolean
          show_profiles?: boolean
          show_quality?: boolean
          show_streams?: boolean
          show_uninterrupted_fullscreen?: boolean
          show_vip_support?: boolean
          slug: string
          sort_order?: number
          streams_enabled?: boolean
          uninterrupted_fullscreen?: boolean
          updated_at?: string
          vip_support?: boolean
        }
        Update: {
          accent_color?: string
          ads_free?: boolean
          badge?: string | null
          custom_avatar_upload?: boolean
          downloads_allowed?: boolean
          enabled?: boolean
          inherited_from?: string | null
          max_profiles?: number
          max_streams?: number
          multi_status_selection?: boolean
          name?: string
          pdf_export?: boolean
          price_label?: string
          priority_servers?: boolean
          priority_support?: boolean
          profiles_enabled?: boolean
          quality_enabled?: boolean
          quality_label?: string
          quality_max?: string
          show_ads_free?: boolean
          show_downloads?: boolean
          show_pdf_export?: boolean
          show_priority_servers?: boolean
          show_priority_support?: boolean
          show_profiles?: boolean
          show_quality?: boolean
          show_streams?: boolean
          show_uninterrupted_fullscreen?: boolean
          show_vip_support?: boolean
          slug?: string
          sort_order?: number
          streams_enabled?: boolean
          uninterrupted_fullscreen?: boolean
          updated_at?: string
          vip_support?: boolean
        }
        Relationships: []
      }
      profile_stats: {
        Row: {
          episodes_completed: number
          lists_count: number
          profile_id: string | null
          total_watch_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          episodes_completed?: number
          lists_count?: number
          profile_id?: string | null
          total_watch_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          episodes_completed?: number
          lists_count?: number
          profile_id?: string | null
          total_watch_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          expiry_notice_sent_at: string | null
          id: string
          last_seen_notification_id: string | null
          plan_type: string | null
          subscription_email: string | null
          subscription_expires_at: string | null
          subscription_status: string
          subscription_updated_at: string | null
          trusted_until: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          expiry_notice_sent_at?: string | null
          id?: string
          last_seen_notification_id?: string | null
          plan_type?: string | null
          subscription_email?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string
          subscription_updated_at?: string | null
          trusted_until?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          expiry_notice_sent_at?: string | null
          id?: string
          last_seen_notification_id?: string | null
          plan_type?: string | null
          subscription_email?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string
          subscription_updated_at?: string | null
          trusted_until?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      ranking_overrides: {
        Row: {
          anilist_id: number
          anime_title: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          position: number
          updated_at: string
        }
        Insert: {
          anilist_id: number
          anime_title?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          position: number
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          anime_title?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      roleplay_missions: {
        Row: {
          active: boolean
          created_at: string
          current_cycle_start: string | null
          description: string
          icon: string
          pool: string
          slug: string
          target: number
          title: string
          type: string
          xp_reward: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          current_cycle_start?: string | null
          description: string
          icon?: string
          pool?: string
          slug: string
          target?: number
          title: string
          type: string
          xp_reward?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          current_cycle_start?: string | null
          description?: string
          icon?: string
          pool?: string
          slug?: string
          target?: number
          title?: string
          type?: string
          xp_reward?: number
        }
        Relationships: []
      }
      slugs: {
        Row: {
          anilist_id: number
          cover_image: string | null
          created_at: string
          created_by: string | null
          manual_slug: string | null
          notes: string | null
          slug: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          anilist_id: number
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          manual_slug?: string | null
          notes?: string | null
          slug?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          manual_slug?: string | null
          notes?: string | null
          slug?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      streaming_sessions: {
        Row: {
          anime_id: number | null
          device_id: string
          ended_at: string | null
          episode_number: number | null
          id: string
          last_heartbeat_at: string
          profile_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          anime_id?: number | null
          device_id: string
          ended_at?: string | null
          episode_number?: number | null
          id?: string
          last_heartbeat_at?: string
          profile_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          anime_id?: number | null
          device_id?: string
          ended_at?: string | null
          episode_number?: number | null
          id?: string
          last_heartbeat_at?: string
          profile_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_id: string | null
          admin_response: string | null
          created_at: string
          id: string
          image_url: string | null
          message: string
          plan_slug: string | null
          priority: string
          responded_at: string | null
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_response?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          message: string
          plan_slug?: string | null
          priority?: string
          responded_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          admin_response?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string
          plan_slug?: string | null
          priority?: string
          responded_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_slug: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_slug: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_slug?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_slug_fkey"
            columns: ["achievement_slug"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_cosmetics: {
        Row: {
          avatar_frame: string
          banner_preset: string
          banner_url: string | null
          cursor_theme: string
          name_effect: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_frame?: string
          banner_preset?: string
          banner_url?: string | null
          cursor_theme?: string
          name_effect?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_frame?: string
          banner_preset?: string
          banner_url?: string | null
          cursor_theme?: string
          name_effect?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_gacha_inventory: {
        Row: {
          acquired_at: string
          pool: string
          rarity: Database["public"]["Enums"]["cosmetic_rarity"] | null
          slug: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          pool: string
          rarity?: Database["public"]["Enums"]["cosmetic_rarity"] | null
          slug: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          pool?: string
          rarity?: Database["public"]["Enums"]["cosmetic_rarity"] | null
          slug?: string
          user_id?: string
        }
        Relationships: []
      }
      user_gacha_tokens: {
        Row: {
          last_awarded_at: string | null
          tokens: number
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          last_awarded_at?: string | null
          tokens?: number
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          last_awarded_at?: string | null
          tokens?: number
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_missions: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          cycle_started_at: string
          mission_slug: string
          progress: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          cycle_started_at?: string
          mission_slug: string
          progress?: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          cycle_started_at?: string
          mission_slug?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_slug_fkey"
            columns: ["mission_slug"]
            isOneToOne: false
            referencedRelation: "roleplay_missions"
            referencedColumns: ["slug"]
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
      user_xp: {
        Row: {
          level: number
          rank_slug: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          level?: number
          rank_slug?: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          level?: number
          rank_slug?: string
          updated_at?: string
          user_id?: string
          xp?: number
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
      video_cache_blocks: {
        Row: {
          anilist_id: number
          block_index: number
          block_label: string | null
          created_at: string
          created_by: string | null
          episode_from: number
          episode_to: number
          id: string
          inverse_mode: boolean
          lang: string
          seeke_base_url: string
          slug: string
          source_episode_offset: number
          updated_at: string
        }
        Insert: {
          anilist_id: number
          block_index: number
          block_label?: string | null
          created_at?: string
          created_by?: string | null
          episode_from: number
          episode_to: number
          id?: string
          inverse_mode?: boolean
          lang?: string
          seeke_base_url: string
          slug: string
          source_episode_offset?: number
          updated_at?: string
        }
        Update: {
          anilist_id?: number
          block_index?: number
          block_label?: string | null
          created_at?: string
          created_by?: string | null
          episode_from?: number
          episode_to?: number
          id?: string
          inverse_mode?: boolean
          lang?: string
          seeke_base_url?: string
          slug?: string
          source_episode_offset?: number
          updated_at?: string
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
          profile_id: string | null
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
          profile_id?: string | null
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
          profile_id?: string | null
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
      admin_set_user_subscription: {
        Args: {
          _expires_at?: string
          _plan_type?: string
          _status: string
          _user_id: string
        }
        Returns: undefined
      }
      auto_expire_subscriptions: { Args: never; Returns: number }
      award_xp: {
        Args: { _amount: number; _user_id: string }
        Returns: {
          level: number
          rank_slug: string
          updated_at: string
          user_id: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "user_xp"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bump_profile_stats: {
        Args: {
          _episodes_delta: number
          _lists_delta: number
          _profile_id: string
          _seconds_delta: number
          _user_id: string
        }
        Returns: undefined
      }
      calc_level_from_xp: { Args: { _xp: number }; Returns: number }
      calc_rank_from_level: { Args: { _level: number }; Returns: string }
      claim_mission: { Args: { _slug: string }; Returns: Json }
      cleanup_old_data: { Args: never; Returns: Json }
      cleanup_stale_streams: { Args: { _user_id: string }; Returns: undefined }
      consume_weekly_pending_reserve: {
        Args: { _limit?: number }
        Returns: number
      }
      delete_download_tracker: {
        Args: { _tracker_id: string }
        Returns: undefined
      }
      end_all_streams_except: {
        Args: { _session_id: string }
        Returns: undefined
      }
      end_stream: { Args: { _session_id: string }; Returns: undefined }
      equip_cosmetics: {
        Args: {
          _avatar_frame: string
          _banner_preset: string
          _banner_url: string
          _cursor_theme: string
          _name_effect: string
        }
        Returns: {
          avatar_frame: string
          banner_preset: string
          banner_url: string | null
          cursor_theme: string
          name_effect: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_cosmetics"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gacha_pull: { Args: { _pool: string }; Returns: Json }
      get_anime_ids_with_seeke_master: {
        Args: never
        Returns: {
          anilist_id: number
        }[]
      }
      get_anime_like_count: { Args: { _anilist_id: number }; Returns: number }
      get_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          avatar_frame: string
          avatar_url: string
          banner_preset: string
          banner_url: string
          display_name: string
          lvl: number
          name_effect: string
          rank_position: number
          rank_slug: string
          user_id: string
          xp: number
        }[]
      }
      get_pending_reserve_admin_stats: {
        Args: never
        Returns: {
          approved: number
          available: number
          consumed: number
          hidden_active: number
          seeke_master: number
          total: number
        }[]
      }
      get_unreleased_reserve_anime_ids: {
        Args: never
        Returns: {
          anilist_id: number
        }[]
      }
      get_user_max_profiles: { Args: { _user_id: string }; Returns: number }
      get_user_max_streams: { Args: { _user_id: string }; Returns: number }
      get_user_plan_slug: { Args: { _user_id: string }; Returns: string }
      get_user_rank_position: { Args: { _user_id: string }; Returns: number }
      get_video_cache_row: {
        Args: {
          _anilist_id?: number
          _episode: number
          _lang: string
          _slug: string
        }
        Returns: {
          anilist_id: number
          anime_title: string
          episode: number
          has_seeke: boolean
          id: string
          lang: string
          slug: string
          sources: Json
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heartbeat_stream: { Args: { _session_id: string }; Returns: undefined }
      increment_anime_view: { Args: { _anilist_id: number }; Returns: number }
      is_device_session_valid: {
        Args: {
          _device_id: string
          _session_fingerprint: string
          _user_id: string
        }
        Returns: boolean
      }
      list_dubbed_anime_ids: {
        Args: never
        Returns: {
          anilist_id: number
          slug: string
        }[]
      }
      list_video_blocks_public: {
        Args: { _anilist_id: number; _lang: string }
        Returns: {
          anilist_id: number
          block_index: number
          block_label: string
          episode_from: number
          episode_to: number
          id: string
          inverse_mode: boolean
          lang: string
          slug: string
          source_episode_offset: number
        }[]
      }
      purge_old_data: { Args: never; Returns: undefined }
      revoke_all_device_sessions: {
        Args: { _user_id: string }
        Returns: undefined
      }
      revoke_device_session: {
        Args: { _device_id: string; _user_id: string }
        Returns: undefined
      }
      rotate_weekly_missions: { Args: never; Returns: Json }
      start_stream: {
        Args: {
          _anime_id: number
          _device_id: string
          _episode_number: number
          _profile_id: string
        }
        Returns: Json
      }
      submit_broken_link_report: {
        Args: {
          _anilist_id: number
          _anime_cover: string
          _anime_title: string
          _episode_number: number
          _plan_slug: string
          _priority_label: string
          _priority_score: number
          _reason: string
          _report_type: string
          _slug: string
        }
        Returns: string
      }
      tick_mission: {
        Args: { _delta?: number; _slug: string; _user_id: string }
        Returns: undefined
      }
      touch_device_session: {
        Args: {
          _device_id: string
          _device_name: string
          _platform: string
          _session_fingerprint: string
          _user_agent: string
          _user_id: string
        }
        Returns: {
          created_at: string
          device_id: string
          device_name: string | null
          id: string
          last_active_at: string
          platform: string | null
          revoked_at: string | null
          session_fingerprint: string | null
          user_agent: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "device_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unlock_achievement: {
        Args: { _slug: string; _user_id: string }
        Returns: boolean
      }
      user_owns_cosmetic: {
        Args: { _pool: string; _slug: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      anime_list_type:
        | "favorite"
        | "watching"
        | "completed"
        | "plan_to_watch"
        | "undecided"
        | "waiting"
      app_role: "owner" | "admin" | "premium" | "user"
      cosmetic_rarity:
        | "basico"
        | "especial"
        | "raro"
        | "mitico"
        | "legendario"
        | "z"
      membership_status: "pending" | "active" | "expired" | "rejected"
      membership_type: "monthly" | "annual" | "lifetime"
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
        "waiting",
      ],
      app_role: ["owner", "admin", "premium", "user"],
      cosmetic_rarity: [
        "basico",
        "especial",
        "raro",
        "mitico",
        "legendario",
        "z",
      ],
      membership_status: ["pending", "active", "expired", "rejected"],
      membership_type: ["monthly", "annual", "lifetime"],
    },
  },
} as const
