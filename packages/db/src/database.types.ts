export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      credits: {
        Row: {
          character: string | null
          id: number
          movie_id: number | null
          person_id: number
          role: Database["public"]["Enums"]["credit_role"]
          series_id: number | null
          sort: number | null
        }
        Insert: {
          character?: string | null
          id?: never
          movie_id?: number | null
          person_id: number
          role: Database["public"]["Enums"]["credit_role"]
          series_id?: number | null
          sort?: number | null
        }
        Update: {
          character?: string | null
          id?: never
          movie_id?: number | null
          person_id?: number
          role?: Database["public"]["Enums"]["credit_role"]
          series_id?: number | null
          sort?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credits_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_progress"
            referencedColumns: ["series_id"]
          },
        ]
      }
      episodes: {
        Row: {
          aired: string | null
          id: number
          image_url: string | null
          name: string | null
          number: number
          overview: string | null
          provider_updated_at: string | null
          runtime_min: number | null
          season_number: number
          series_id: number
        }
        Insert: {
          aired?: string | null
          id?: never
          image_url?: string | null
          name?: string | null
          number: number
          overview?: string | null
          provider_updated_at?: string | null
          runtime_min?: number | null
          season_number: number
          series_id: number
        }
        Update: {
          aired?: string | null
          id?: never
          image_url?: string | null
          name?: string | null
          number?: number
          overview?: string | null
          provider_updated_at?: string | null
          runtime_min?: number | null
          season_number?: number
          series_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_progress"
            referencedColumns: ["series_id"]
          },
        ]
      }
      external_ids: {
        Row: {
          entity_id: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          provider: Database["public"]["Enums"]["metadata_provider"]
          provider_id: string
        }
        Insert: {
          entity_id: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          provider: Database["public"]["Enums"]["metadata_provider"]
          provider_id: string
        }
        Update: {
          entity_id?: number
          entity_type?: Database["public"]["Enums"]["entity_type"]
          provider?: Database["public"]["Enums"]["metadata_provider"]
          provider_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          entity_id: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: number
          entity_type?: Database["public"]["Enums"]["entity_type"]
          user_id?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          created_at: string
          fetched_at: string | null
          genres: string[]
          id: number
          name: string
          overview: string | null
          poster_url: string | null
          provider_updated_at: string | null
          released: string | null
          runtime_min: number | null
        }
        Insert: {
          created_at?: string
          fetched_at?: string | null
          genres?: string[]
          id?: never
          name: string
          overview?: string | null
          poster_url?: string | null
          provider_updated_at?: string | null
          released?: string | null
          runtime_min?: number | null
        }
        Update: {
          created_at?: string
          fetched_at?: string | null
          genres?: string[]
          id?: never
          name?: string
          overview?: string | null
          poster_url?: string | null
          provider_updated_at?: string | null
          released?: string | null
          runtime_min?: number | null
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string
          fetched_at: string | null
          id: number
          image_url: string | null
          name: string
          provider_updated_at: string | null
        }
        Insert: {
          created_at?: string
          fetched_at?: string | null
          id?: never
          image_url?: string | null
          name: string
          provider_updated_at?: string | null
        }
        Update: {
          created_at?: string
          fetched_at?: string | null
          id?: never
          image_url?: string | null
          name?: string
          provider_updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          is_admin: boolean
          plan: Database["public"]["Enums"]["plan"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          is_admin?: boolean
          plan?: Database["public"]["Enums"]["plan"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          is_admin?: boolean
          plan?: Database["public"]["Enums"]["plan"]
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          entity_id: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: number
          entity_type?: Database["public"]["Enums"]["entity_type"]
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          id: number
          name: string | null
          number: number
          poster_url: string | null
          series_id: number
        }
        Insert: {
          id?: never
          name?: string | null
          number: number
          poster_url?: string | null
          series_id: number
        }
        Update: {
          id?: never
          name?: string | null
          number?: number
          poster_url?: string | null
          series_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_progress"
            referencedColumns: ["series_id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          fetched_at: string | null
          first_aired: string | null
          genres: string[]
          id: number
          name: string
          overview: string | null
          poster_url: string | null
          provider_updated_at: string | null
          runtime_min: number | null
          status: string | null
        }
        Insert: {
          created_at?: string
          fetched_at?: string | null
          first_aired?: string | null
          genres?: string[]
          id?: never
          name: string
          overview?: string | null
          poster_url?: string | null
          provider_updated_at?: string | null
          runtime_min?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string
          fetched_at?: string | null
          first_aired?: string | null
          genres?: string[]
          id?: never
          name?: string
          overview?: string | null
          poster_url?: string | null
          provider_updated_at?: string | null
          runtime_min?: number | null
          status?: string | null
        }
        Relationships: []
      }
      watches: {
        Row: {
          created_at: string
          entity_id: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: number
          user_id: string
          watched_at: string | null
        }
        Insert: {
          created_at?: string
          entity_id: number
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: never
          user_id: string
          watched_at?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: number
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: never
          user_id?: string
          watched_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      season_progress: {
        Row: {
          aired_count: number | null
          episode_count: number | null
          runtime_min: number | null
          season_number: number | null
          seen_count: number | null
          seen_runtime_min: number | null
          series_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_progress"
            referencedColumns: ["series_id"]
          },
        ]
      }
      series_progress: {
        Row: {
          aired_episodes: number | null
          first_aired: string | null
          name: string | null
          overview: string | null
          poster_url: string | null
          rating: number | null
          runtime_min: number | null
          series_id: number | null
          user_id: string | null
          watched_episodes: number | null
        }
        Relationships: []
      }
      watch_totals: {
        Row: {
          episode_minutes: number | null
          episodes_seen: number | null
          minutes_watched: number | null
          movie_minutes: number | null
          movies_seen: number | null
          user_id: string | null
        }
        Relationships: []
      }
      watched_episodes: {
        Row: {
          episode_id: number | null
          season_number: number | null
          series_id: number | null
          user_id: string | null
          watched_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series_progress"
            referencedColumns: ["series_id"]
          },
        ]
      }
    }
    Functions: {
      mark_episodes_seen: {
        Args: { p_season_number?: number; p_series_id: number }
        Returns: undefined
      }
      resolve_entity: {
        Args: {
          p_entity_type: Database["public"]["Enums"]["entity_type"]
          p_name: string
          p_provider: Database["public"]["Enums"]["metadata_provider"]
          p_provider_id: string
        }
        Returns: number
      }
      unmark_episodes_seen: {
        Args: { p_season_number?: number; p_series_id: number }
        Returns: undefined
      }
    }
    Enums: {
      credit_role: "actor" | "director" | "creator" | "writer"
      entity_type: "series" | "season" | "episode" | "movie" | "person"
      metadata_provider: "tvdb"
      plan: "comp" | "basic" | "pro"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      credit_role: ["actor", "director", "creator", "writer"],
      entity_type: ["series", "season", "episode", "movie", "person"],
      metadata_provider: ["tvdb"],
      plan: ["comp", "basic", "pro"],
    },
  },
} as const

