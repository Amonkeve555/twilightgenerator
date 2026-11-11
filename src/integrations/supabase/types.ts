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
      faction_data_overrides: {
        Row: {
          applied_by: string | null
          applied_from_proposal: string | null
          citations: Json
          created_at: string
          data: Json
          faction_name: string
          id: string
          updated_at: string
        }
        Insert: {
          applied_by?: string | null
          applied_from_proposal?: string | null
          citations?: Json
          created_at?: string
          data: Json
          faction_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          applied_by?: string | null
          applied_from_proposal?: string | null
          citations?: Json
          created_at?: string
          data?: Json
          faction_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      faction_data_proposals: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          proposal: Json
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          proposal: Json
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          proposal?: Json
          status?: string
        }
        Relationships: []
      }
      lobbies: {
        Row: {
          created_at: string
          custom_map: Json | null
          ended_at: string | null
          game_date: string | null
          host_name: string
          host_session_id: string
          host_user_id: string | null
          id: string
          invite_code: string
          settings: Json
          started_at: string | null
          status: string
          tile_control: Json
          token_mapping: Json | null
        }
        Insert: {
          created_at?: string
          custom_map?: Json | null
          ended_at?: string | null
          game_date?: string | null
          host_name?: string
          host_session_id: string
          host_user_id?: string | null
          id?: string
          invite_code: string
          settings?: Json
          started_at?: string | null
          status?: string
          tile_control?: Json
          token_mapping?: Json | null
        }
        Update: {
          created_at?: string
          custom_map?: Json | null
          ended_at?: string | null
          game_date?: string | null
          host_name?: string
          host_session_id?: string
          host_user_id?: string | null
          id?: string
          invite_code?: string
          settings?: Json
          started_at?: string | null
          status?: string
          tile_control?: Json
          token_mapping?: Json | null
        }
        Relationships: []
      }
      lobby_players: {
        Row: {
          assigned_factions: Json | null
          chosen_faction: Json | null
          display_color: string | null
          id: string
          joined_at: string
          lobby_id: string
          player_name: string
          rank: number | null
          seat_index: number | null
          session_id: string
          token_picks: number[] | null
          user_id: string | null
          vp: number | null
        }
        Insert: {
          assigned_factions?: Json | null
          chosen_faction?: Json | null
          display_color?: string | null
          id?: string
          joined_at?: string
          lobby_id: string
          player_name: string
          rank?: number | null
          seat_index?: number | null
          session_id: string
          token_picks?: number[] | null
          user_id?: string | null
          vp?: number | null
        }
        Update: {
          assigned_factions?: Json | null
          chosen_faction?: Json | null
          display_color?: string | null
          id?: string
          joined_at?: string
          lobby_id?: string
          player_name?: string
          rank?: number | null
          seat_index?: number | null
          session_id?: string
          token_picks?: number[] | null
          user_id?: string | null
          vp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lobby_players_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      map_templates: {
        Row: {
          created_at: string
          data: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          nickname: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          nickname?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          nickname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rules_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          page_end: number | null
          page_start: number | null
          section: string | null
          source_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
          section?: string | null
          source_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
          section?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "rules_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rules_sources: {
        Row: {
          chunk_count: number
          created_at: string
          error: string | null
          filename: string
          id: string
          label: string
          page_count: number | null
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          chunk_count?: number
          created_at?: string
          error?: string | null
          filename: string
          id?: string
          label: string
          page_count?: number | null
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          chunk_count?: number
          created_at?: string
          error?: string | null
          filename?: string
          id?: string
          label?: string
          page_count?: number | null
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
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
      admin_link_guest_data: {
        Args: { p_session_ids: string[]; p_target_user_id: string }
        Returns: Json
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          nickname: string
        }[]
      }
      assign_seat: {
        Args: { p_lobby_id: string; p_player_id: string; p_seat_index: number }
        Returns: Json
      }
      auto_assign_missing_factions: {
        Args: { p_lobby_id: string }
        Returns: Json
      }
      claim_faction: {
        Args: { p_faction: Json; p_lobby_id: string; p_player_id: string }
        Returns: Json
      }
      claim_guest_data: { Args: { p_session_ids: string[] }; Returns: Json }
      claim_token: {
        Args: { p_lobby_id: string; p_player_id: string; p_token_id: number }
        Returns: Json
      }
      clear_player_pick: { Args: { p_player_id: string }; Returns: Json }
      clear_seats: { Args: { p_lobby_id: string }; Returns: Json }
      clear_tile_control: { Args: { p_lobby_id: string }; Returns: Json }
      end_game: { Args: { p_lobby_id: string }; Returns: Json }
      finish_game: {
        Args: { p_lobby_id: string; p_results: Json }
        Returns: Json
      }
      get_forbidden_tokens: { Args: { p_lobby_id: string }; Returns: number[] }
      get_last_played_faction_vs_opponents: {
        Args: { p_opponent_ids: string[]; p_user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_rules_chunks: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: string
          page_end: number
          page_start: number
          section: string
          similarity: number
          source_id: string
          source_label: string
        }[]
      }
      reset_lobby_draft: { Args: { p_lobby_id: string }; Returns: Json }
      set_tile_control: {
        Args: {
          p_lobby_id: string
          p_q: number
          p_r: number
          p_seat_index: number
        }
        Returns: Json
      }
      shuffle_seats: { Args: { p_lobby_id: string }; Returns: Json }
      start_game: { Args: { p_lobby_id: string }; Returns: Json }
      update_lobby_results: {
        Args: { p_lobby_id: string; p_results: Json }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
