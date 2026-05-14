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
      audit_log: {
        Row: {
          action: string
          details: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          timestamp: string
          user_id: string
        }
        Insert: {
          action: string
          details: string
          entity_id: string
          entity_type: string
          id: string
          ip_address?: string | null
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string
          details?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_channels: {
        Row: {
          created_at: string
          deal_id: string | null
          id: string
          label: string
          participant_ids: Json
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          id: string
          label: string
          participant_ids?: Json
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          id?: string
          label?: string
          participant_ids?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: Json
          body: string
          channel_id: string
          deal_id: string | null
          id: string
          linked_message_id: string | null
          sender_id: string
          sender_name: string
          sender_type: string
          timestamp: string
        }
        Insert: {
          attachments?: Json
          body: string
          channel_id: string
          deal_id?: string | null
          id: string
          linked_message_id?: string | null
          sender_id: string
          sender_name: string
          sender_type: string
          timestamp?: string
        }
        Update: {
          attachments?: Json
          body?: string
          channel_id?: string
          deal_id?: string | null
          id?: string
          linked_message_id?: string | null
          sender_id?: string
          sender_name?: string
          sender_type?: string
          timestamp?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          bookrunners: Json
          business_day_convention: string | null
          common_code: string | null
          coupon: string
          created_at: string
          created_by_org: string | null
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
          created_by_org?: string | null
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
          created_by_org?: string | null
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
      distribution_lists: {
        Row: {
          created_by: string
          created_by_org: string | null
          id: string
          last_used: string | null
          member_ids: Json
          name: string
          vendor_ids: Json
        }
        Insert: {
          created_by: string
          created_by_org?: string | null
          id: string
          last_used?: string | null
          member_ids?: Json
          name: string
          vendor_ids?: Json
        }
        Update: {
          created_by?: string
          created_by_org?: string | null
          id?: string
          last_used?: string | null
          member_ids?: Json
          name?: string
          vendor_ids?: Json
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
      guest_passcodes: {
        Row: {
          created_at: string
          created_by: string | null
          deal_ids: Json
          email: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          name: string | null
          passcode: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deal_ids?: Json
          email: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string | null
          passcode: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deal_ids?: Json
          email?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string | null
          passcode?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          ai_suggestions: Json | null
          attachments: Json
          body: string
          created_at: string
          deal_ids: Json
          id: string
          parent_message_id: string | null
          recipients: Json
          retracted_at: string | null
          retracted_by: string | null
          sender_id: string
          sent_at: string | null
          status: string
          subject: string
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          ai_suggestions?: Json | null
          attachments?: Json
          body: string
          created_at?: string
          deal_ids?: Json
          id: string
          parent_message_id?: string | null
          recipients?: Json
          retracted_at?: string | null
          retracted_by?: string | null
          sender_id: string
          sent_at?: string | null
          status: string
          subject: string
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_suggestions?: Json | null
          attachments?: Json
          body?: string
          created_at?: string
          deal_ids?: Json
          id?: string
          parent_message_id?: string | null
          recipients?: Json
          retracted_at?: string | null
          retracted_by?: string | null
          sender_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          deal_id: string | null
          id: string
          message_id: string | null
          read: boolean
          timestamp: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          deal_id?: string | null
          id: string
          message_id?: string | null
          read?: boolean
          timestamp?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          deal_id?: string | null
          id?: string
          message_id?: string | null
          read?: boolean
          timestamp?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          legacy_user_id: string | null
          name: string | null
          organization: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          legacy_user_id?: string | null
          name?: string | null
          organization?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          legacy_user_id?: string | null
          name?: string | null
          organization?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_request_rate_limit: {
        Row: {
          count: number
          ip: string
          window_start: string
        }
        Insert: {
          count?: number
          ip: string
          window_start?: string
        }
        Update: {
          count?: number
          ip?: string
          window_start?: string
        }
        Relationships: []
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
      users: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          created_by_org: string | null
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
          created_by_org?: string | null
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
          created_by_org?: string | null
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_login_stats: {
        Args: never
        Returns: {
          confirmed_at: string
          email: string
          last_sign_in_at: string
          user_created_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
      app_role:
        | "master_admin"
        | "syndicate_admin"
        | "syndicate_readonly"
        | "sales_readonly"
        | "vendor_user"
        | "guest"
      profile_status: "pending" | "approved" | "rejected" | "disabled"
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
      app_role: [
        "master_admin",
        "syndicate_admin",
        "syndicate_readonly",
        "sales_readonly",
        "vendor_user",
        "guest",
      ],
      profile_status: ["pending", "approved", "rejected", "disabled"],
    },
  },
} as const
