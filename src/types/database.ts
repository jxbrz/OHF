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
      app_settings: {
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
      audit_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reviews: {
        Row: {
          body: string
          created_by: string | null
          generated_at: string
          id: string
          model: string | null
          raw_json: Json | null
          review_date: string
          snapshot_id: string | null
          summary: string
          title: string
        }
        Insert: {
          body: string
          created_by?: string | null
          generated_at?: string
          id?: string
          model?: string | null
          raw_json?: Json | null
          review_date: string
          snapshot_id?: string | null
          summary: string
          title: string
        }
        Update: {
          body?: string
          created_by?: string | null
          generated_at?: string
          id?: string
          model?: string | null
          raw_json?: Json | null
          review_date?: string
          snapshot_id?: string | null
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reviews_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "portfolio_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_transactions: {
        Row: {
          amount: number
          counterparty_member_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          member_id: string
          notes: string | null
          transfer_group_id: string | null
          type: string
          unit_price_at_time: number
          units_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          counterparty_member_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          member_id: string
          notes?: string | null
          transfer_group_id?: string | null
          type: string
          unit_price_at_time: number
          units_amount: number
          updated_at?: string
        }
        Update: {
          amount?: number
          counterparty_member_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          member_id?: string
          notes?: string | null
          transfer_group_id?: string | null
          type?: string
          unit_price_at_time?: number
          units_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_transactions_counterparty_member_id_fkey"
            columns: ["counterparty_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      holding_snapshots: {
        Row: {
          allocation_pct: number | null
          average_open: number | null
          current_price: number | null
          id: string
          instrument_name: string | null
          market_value: number | null
          pnl: number | null
          portfolio_snapshot_id: string
          quantity: number | null
          symbol: string
        }
        Insert: {
          allocation_pct?: number | null
          average_open?: number | null
          current_price?: number | null
          id?: string
          instrument_name?: string | null
          market_value?: number | null
          pnl?: number | null
          portfolio_snapshot_id: string
          quantity?: number | null
          symbol: string
        }
        Update: {
          allocation_pct?: number | null
          average_open?: number | null
          current_price?: number | null
          id?: string
          instrument_name?: string | null
          market_value?: number | null
          pnl?: number | null
          portfolio_snapshot_id?: string
          quantity?: number | null
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "holding_snapshots_portfolio_snapshot_id_fkey"
            columns: ["portfolio_snapshot_id"]
            isOneToOne: false
            referencedRelation: "portfolio_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      member_reconciliation_targets: {
        Row: {
          as_of_date: string
          member_id: string
          notes: string | null
          target_units: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          as_of_date?: string
          member_id: string
          notes?: string | null
          target_units: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          as_of_date?: string
          member_id?: string
          notes?: string | null
          target_units?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_reconciliation_targets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_reconciliation_targets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_snapshots: {
        Row: {
          available_cash: number | null
          captured_at: string
          id: string
          raw_json: Json | null
          realized_pnl: number | null
          total_account_value: number
          total_units: number
          unit_price: number
          unrealized_pnl: number | null
        }
        Insert: {
          available_cash?: number | null
          captured_at?: string
          id?: string
          raw_json?: Json | null
          realized_pnl?: number | null
          total_account_value: number
          total_units: number
          unit_price: number
          unrealized_pnl?: number | null
        }
        Update: {
          available_cash?: number | null
          captured_at?: string
          id?: string
          raw_json?: Json | null
          realized_pnl?: number | null
          total_account_value?: number
          total_units?: number
          unit_price?: number
          unrealized_pnl?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          role?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { user_id?: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
