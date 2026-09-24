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
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          left_at: string | null
          removed_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          left_at?: string | null
          removed_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          left_at?: string | null
          removed_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          invite_expires_at: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code: string
          invite_expires_at?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          invite_expires_at?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_sets: {
        Row: {
          complete: boolean
          games_a: number
          games_b: number
          match_id: string
          set_number: number
          tiebreak_a: number | null
          tiebreak_b: number | null
          tiebreak_target: number | null
        }
        Insert: {
          complete: boolean
          games_a: number
          games_b: number
          match_id: string
          set_number: number
          tiebreak_a?: number | null
          tiebreak_b?: number | null
          tiebreak_target?: number | null
        }
        Update: {
          complete?: boolean
          games_a?: number
          games_b?: number
          match_id?: string
          set_number?: number
          tiebreak_a?: number | null
          tiebreak_b?: number | null
          tiebreak_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          confirmed_at: string | null
          created_at: string
          format: string
          group_id: string
          id: string
          outcome: string
          played_on: string
          player_a: string
          player_b: string
          rejected_at: string | null
          rejection_reason: string | null
          retired_by: string | null
          status: string
          submitted_by: string
          tournament_tie_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          winner: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          format?: string
          group_id: string
          id?: string
          outcome: string
          played_on?: string
          player_a: string
          player_b: string
          rejected_at?: string | null
          rejection_reason?: string | null
          retired_by?: string | null
          status?: string
          submitted_by: string
          tournament_tie_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          winner: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          format?: string
          group_id?: string
          id?: string
          outcome?: string
          played_on?: string
          player_a?: string
          player_b?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          retired_by?: string | null
          status?: string
          submitted_by?: string
          tournament_tie_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          winner?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player_a_fkey"
            columns: ["player_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player_b_fkey"
            columns: ["player_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_retired_by_fkey"
            columns: ["retired_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_tie_id_fkey"
            columns: ["tournament_tie_id"]
            isOneToOne: false
            referencedRelation: "tournament_ties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_fkey"
            columns: ["winner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string
          hometown: string | null
          id: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          hometown?: string | null
          id: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          hometown?: string | null
          id?: string
        }
        Relationships: []
      }
      tournament_entrants: {
        Row: {
          registered_at: string
          seed: number | null
          tournament_id: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          registered_at?: string
          seed?: number | null
          tournament_id: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          registered_at?: string
          seed?: number | null
          tournament_id?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entrants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entrants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_events: {
        Row: {
          actor: string | null
          created_at: string
          detail: string | null
          id: number
          kind: string
          tournament_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          kind: string
          tournament_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          detail?: string | null
          id?: never
          kind?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_events_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_ties: {
        Row: {
          deadline: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          match_id: string | null
          player_a: string | null
          player_b: string | null
          position: number
          round: number
          tournament_id: string
          winner_id: string | null
        }
        Insert: {
          deadline?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          match_id?: string | null
          player_a?: string | null
          player_b?: string | null
          position: number
          round: number
          tournament_id: string
          winner_id?: string | null
        }
        Update: {
          deadline?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          match_id?: string | null
          player_a?: string | null
          player_b?: string | null
          position?: number
          round?: number
          tournament_id?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_ties_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_player_a_fkey"
            columns: ["player_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_player_b_fkey"
            columns: ["player_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          champion_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          draw_size: number | null
          entrant_cap: number
          format: string
          group_id: string
          id: string
          name: string
          round_days: number
          seeding: string
          started_at: string | null
          status: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          champion_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          draw_size?: number | null
          entrant_cap: number
          format?: string
          group_id: string
          id?: string
          name: string
          round_days?: number
          seeding?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          champion_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          draw_size?: number | null
          entrant_cap?: number
          format?: string
          group_id?: string
          id?: string
          name?: string
          round_days?: number
          seeding?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_champion_id_fkey"
            columns: ["champion_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      group_standings: {
        Row: {
          active: boolean | null
          display_name: string | null
          games_lost: number | null
          games_won: number | null
          group_id: string | null
          losses: number | null
          matches_played: number | null
          user_id: string | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      active_organizer_count: {
        Args: { target_group: string }
        Returns: number
      }
      bracket_order: { Args: { size: number }; Returns: number[] }
      can_see_tournament: { Args: { target: string }; Returns: boolean }
      cancel_tournament: {
        Args: { reason: string; target: string }
        Returns: undefined
      }
      confirm_match: {
        Args: { target_match: string }
        Returns: {
          confirmed_at: string | null
          created_at: string
          format: string
          group_id: string
          id: string
          outcome: string
          played_on: string
          player_a: string
          player_b: string
          rejected_at: string | null
          rejection_reason: string | null
          retired_by: string | null
          status: string
          submitted_by: string
          tournament_tie_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          winner: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_group: { Args: { group_name: string }; Returns: string }
      create_tournament: {
        Args: {
          cap: number
          days_per_round?: number
          seeding_method?: string
          target_group: string
          tournament_format?: string
          tournament_name: string
        }
        Returns: string
      }
      decide_tie_by_organizer: {
        Args: { target_tie: string; winner: string }
        Returns: undefined
      }
      edit_match: {
        Args: {
          match_format?: string
          match_outcome: string
          match_played_on?: string
          match_retired_by?: string
          match_winner: string
          sets: Json
          target_match: string
        }
        Returns: {
          confirmed_at: string | null
          created_at: string
          format: string
          group_id: string
          id: string
          outcome: string
          played_on: string
          player_a: string
          player_b: string
          rejected_at: string | null
          rejection_reason: string | null
          retired_by: string | null
          status: string
          submitted_by: string
          tournament_tie_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          winner: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_rating_history: {
        Args: { p_group_id?: string; p_player_id: string }
        Returns: {
          confirmed_at: string
          delta: number
          group_id: string
          match_id: string
          player_id: string
          rating_after: number
          rating_before: number
        }[]
      }
      get_ratings: {
        Args: { p_group_id?: string }
        Returns: {
          active: boolean
          display_name: string
          matches_played: number
          player_id: string
          rating: number
        }[]
      }
      is_group_member: { Args: { target_group: string }; Returns: boolean }
      is_group_organizer: { Args: { target_group: string }; Returns: boolean }
      is_legal_match_set: {
        Args: { a: number; b: number; done: boolean; ta: number; tb: number }
        Returns: boolean
      }
      is_legal_score_row: {
        Args: {
          a: number
          b: number
          done: boolean
          ta: number
          target: number
          tb: number
        }
        Returns: boolean
      }
      is_withdrawn: {
        Args: { player: string; target: string }
        Returns: boolean
      }
      join_group_by_code: { Args: { code: string }; Returns: string }
      leave_group: { Args: { target_group: string }; Returns: undefined }
      lock_member_match: {
        Args: { target_match: string }
        Returns: {
          confirmed_at: string | null
          created_at: string
          format: string
          group_id: string
          id: string
          outcome: string
          played_on: string
          player_a: string
          player_b: string
          rejected_at: string | null
          rejection_reason: string | null
          retired_by: string | null
          status: string
          submitted_by: string
          tournament_tie_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          winner: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_tournament_event: {
        Args: { event_detail: string; event_kind: string; target: string }
        Returns: undefined
      }
      match_is_visible: {
        Args: { match_rejected_at: string; match_status: string }
        Returns: boolean
      }
      place_winner: { Args: { target_tie: string }; Returns: undefined }
      register_for_tournament: { Args: { target: string }; Returns: undefined }
      reject_match:
        | {
            Args: { target_match: string }
            Returns: {
              confirmed_at: string | null
              created_at: string
              format: string
              group_id: string
              id: string
              outcome: string
              played_on: string
              player_a: string
              player_b: string
              rejected_at: string | null
              rejection_reason: string | null
              retired_by: string | null
              status: string
              submitted_by: string
              tournament_tie_id: string | null
              void_reason: string | null
              voided_at: string | null
              voided_by: string | null
              winner: string
            }
            SetofOptions: {
              from: "*"
              to: "matches"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { reason: string; target_match: string }
            Returns: {
              confirmed_at: string | null
              created_at: string
              format: string
              group_id: string
              id: string
              outcome: string
              played_on: string
              player_a: string
              player_b: string
              rejected_at: string | null
              rejection_reason: string | null
              retired_by: string | null
              status: string
              submitted_by: string
              tournament_tie_id: string | null
              void_reason: string | null
              voided_at: string | null
              voided_by: string | null
              winner: string
            }
            SetofOptions: {
              from: "*"
              to: "matches"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      remove_group_member: {
        Args: { target_group: string; target_user: string }
        Returns: undefined
      }
      replace_match_sets: {
        Args: { sets: Json; target_match: string }
        Returns: undefined
      }
      require_tournament_organizer: {
        Args: { target: string }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          champion_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          draw_size: number | null
          entrant_cap: number
          format: string
          group_id: string
          id: string
          name: string
          round_days: number
          seeding: string
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "tournaments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_group_member: {
        Args: { target_group: string; target_user: string }
        Returns: undefined
      }
      rotate_group_invite: {
        Args: { target_group: string; valid_days?: number }
        Returns: string
      }
      set_group_member_role: {
        Args: { new_role: string; target_group: string; target_user: string }
        Returns: undefined
      }
      settle_tournament: { Args: { target: string }; Returns: undefined }
      shares_group_with: { Args: { other_user: string }; Returns: boolean }
      start_tournament: { Args: { target: string }; Returns: undefined }
      submit_match: {
        Args: {
          match_format?: string
          match_outcome: string
          match_played_on?: string
          match_retired_by?: string
          match_winner: string
          opponent: string
          sets: Json
          target_group: string
        }
        Returns: {
          confirmed_at: string | null
          created_at: string
          format: string
          group_id: string
          id: string
          outcome: string
          played_on: string
          player_a: string
          player_b: string
          rejected_at: string | null
          rejection_reason: string | null
          retired_by: string | null
          status: string
          submitted_by: string
          tournament_tie_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          winner: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_tournament_match: {
        Args: {
          match_outcome: string
          match_played_on?: string
          match_retired_by?: string
          match_winner: string
          sets: Json
          target_tie: string
        }
        Returns: {
          confirmed_at: string | null
          created_at: string
          format: string
          group_id: string
          id: string
          outcome: string
          played_on: string
          player_a: string
          player_b: string
          rejected_at: string | null
          rejection_reason: string | null
          retired_by: string | null
          status: string
          submitted_by: string
          tournament_tie_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          winner: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tournament_rounds: { Args: { target: string }; Returns: number }
      unregister_from_tournament: {
        Args: { target: string }
        Returns: undefined
      }
      validate_match_score: {
        Args: {
          a: string
          b: string
          match_format?: string
          match_outcome: string
          match_played_on: string
          match_retired_by: string
          match_winner: string
          sets: Json
        }
        Returns: undefined
      }
      void_match:
        | {
            Args: { target_match: string }
            Returns: {
              confirmed_at: string | null
              created_at: string
              format: string
              group_id: string
              id: string
              outcome: string
              played_on: string
              player_a: string
              player_b: string
              rejected_at: string | null
              rejection_reason: string | null
              retired_by: string | null
              status: string
              submitted_by: string
              tournament_tie_id: string | null
              void_reason: string | null
              voided_at: string | null
              voided_by: string | null
              winner: string
            }
            SetofOptions: {
              from: "*"
              to: "matches"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { reason: string; target_match: string }
            Returns: {
              confirmed_at: string | null
              created_at: string
              format: string
              group_id: string
              id: string
              outcome: string
              played_on: string
              player_a: string
              player_b: string
              rejected_at: string | null
              rejection_reason: string | null
              retired_by: string | null
              status: string
              submitted_by: string
              tournament_tie_id: string | null
              void_reason: string | null
              voided_at: string | null
              voided_by: string | null
              winner: string
            }
            SetofOptions: {
              from: "*"
              to: "matches"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      withdraw_from_tournament: {
        Args: { player?: string; target: string }
        Returns: undefined
      }
      withdraw_match: { Args: { target_match: string }; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {},
  },
} as const

