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
      deals: {
        Row: {
          bookrunners: Json
          business_day_convention: string | null
          common_code: string | null
          coupon: string
          created_at: string
          currency: string
          cusip: string | null
          day_count_fraction: string | null
          form_of_note: string | null
          governing_law: string | null
          id: string
          interest_payment_frequency: string | null
          interest_rate: string | null
          interest_type: string | null
          isin: string | null
          issuance_type: string | null
          issue_date: string | null
          issue_price: string | null
          issuer_lei: string | null
          issuer_name: string
          issuer_rating: string | null
          listing_venue: string | null
          maturity_date: string | null
          mid_swap_rate: string | null
          optionality: string | null
          pricing_date: string | null
          rating_outlook: string | null
          reoffer_price: string | null
          reoffer_spread: string | null
          reoffer_yield: string | null
          selling_restrictions: string | null
          settlement_date: string | null
          size: string
          specified_denomination: string | null
          stage: string
          stage_history: Json
          status_of_note: string | null
          taxonomy: string | null
          tenor: string
          updated_at: string
        }
        Insert: {
          bookrunners?: Json
          business_day_convention?: string | null
          common_code?: string | null
          coupon: string
          created_at?: string
          currency: string
          cusip?: string | null
          day_count_fraction?: string | null
          form_of_note?: string | null
          governing_law?: string | null
          id: string
          interest_payment_frequency?: string | null
          interest_rate?: string | null
          interest_type?: string | null
          isin?: string | null
          issuance_type?: string | null
          issue_date?: string | null
          issue_price?: string | null
          issuer_lei?: string | null
          issuer_name: string
          issuer_rating?: string | null
          listing_venue?: string | null
          maturity_date?: string | null
          mid_swap_rate?: string | null
          optionality?: string | null
          pricing_date?: string | null
          rating_outlook?: string | null
          reoffer_price?: string | null
          reoffer_spread?: string | null
          reoffer_yield?: string | null
          selling_restrictions?: string | null
          settlement_date?: string | null
          size: string
          specified_denomination?: string | null
          stage: string
          stage_history?: Json
          status_of_note?: string | null
          taxonomy?: string | null
          tenor: string
          updated_at?: string
        }
        Update: {
          bookrunners?: Json
          business_day_convention?: string | null
          common_code?: string | null
          coupon?: string
          created_at?: string
          currency?: string
          cusip?: string | null
          day_count_fraction?: string | null
          form_of_note?: string | null
          governing_law?: string | null
          id?: string
          interest_payment_frequency?: string | null
          interest_rate?: string | null
          interest_type?: string | null
          isin?: string | null
          issuance_type?: string | null
          issue_date?: string | null
          issue_price?: string | null
          issuer_lei?: string | null
          issuer_name?: string
          issuer_rating?: string | null
          listing_venue?: string | null
          maturity_date?: string | null
          mid_swap_rate?: string | null
          optionality?: string | null
          pricing_date?: string | null
          rating_outlook?: string | null
          reoffer_price?: string | null
          reoffer_spread?: string | null
          reoffer_yield?: string | null
          selling_restrictions?: string | null
          settlement_date?: string | null
          size?: string
          specified_denomination?: string | null
          stage?: string
          stage_history?: Json
          status_of_note?: string | null
          taxonomy?: string | null
          tenor?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          organization: string
          organization_type: string
          phone: string | null
          role: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id: string
          name: string
          organization: string
          organization_type: string
          phone?: string | null
          role: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          organization?: string
          organization_type?: string
          phone?: string | null
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
