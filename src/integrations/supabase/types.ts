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
      copilot_changes: {
        Row: {
          after_value: string
          before_value: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          field: string
          id: string
          reason: string
          run_id: string | null
          status: string
          thread_id: string
        }
        Insert: {
          after_value: string
          before_value: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          field: string
          id?: string
          reason: string
          run_id?: string | null
          status?: string
          thread_id: string
        }
        Update: {
          after_value?: string
          before_value?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          field?: string
          id?: string
          reason?: string
          run_id?: string | null
          status?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_changes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "copilot_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_changes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_documents: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string
          document_id: string
          extracted_text: string
          id: string
          thread_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by: string
          document_id: string
          extracted_text: string
          id?: string
          thread_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string
          document_id?: string
          extracted_text?: string
          id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "deal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_documents_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_gateway_state: {
        Row: {
          blocked: boolean
          id: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          id: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          id?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      copilot_messages: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_runs: {
        Row: {
          baseline: Json
          completed_at: string | null
          created_at: string
          document_id: string | null
          error: string | null
          evidence_text: string
          id: string
          kind: string
          lease_token: string | null
          lease_until: string | null
          report: Json | null
          revision: string
          status: string
          thread_id: string
        }
        Insert: {
          baseline?: Json
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error?: string | null
          evidence_text?: string
          id?: string
          kind: string
          lease_token?: string | null
          lease_until?: string | null
          report?: Json | null
          revision: string
          status?: string
          thread_id: string
        }
        Update: {
          baseline?: Json
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error?: string | null
          evidence_text?: string
          id?: string
          kind?: string
          lease_token?: string | null
          lease_until?: string | null
          report?: Json | null
          revision?: string
          status?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "copilot_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_runs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_threads: {
        Row: {
          created_at: string
          created_by: string
          deal_id: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deal_id: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deal_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_threads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_documents: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          mime: string | null
          name: string
          path: string
          size: number
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          mime?: string | null
          name: string
          path: string
          size?: number
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          mime?: string | null
          name?: string
          path?: string
          size?: number
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: []
      }
      deal_term_sheet_releases: {
        Row: {
          bdt_state_snapshot: Json
          bdt_xml: string | null
          checks_summary: Json
          deal_id: string
          diff_summary: Json
          envelope: Json | null
          id: string
          released_at: string
          released_by: string | null
          released_by_name: string | null
          stage: number
          stage_label: string
          version: number
        }
        Insert: {
          bdt_state_snapshot: Json
          bdt_xml?: string | null
          checks_summary?: Json
          deal_id: string
          diff_summary?: Json
          envelope?: Json | null
          id?: string
          released_at?: string
          released_by?: string | null
          released_by_name?: string | null
          stage: number
          stage_label?: string
          version: number
        }
        Update: {
          bdt_state_snapshot?: Json
          bdt_xml?: string | null
          checks_summary?: Json
          deal_id?: string
          diff_summary?: Json
          envelope?: Json | null
          id?: string
          released_at?: string
          released_by?: string | null
          released_by_name?: string | null
          stage?: number
          stage_label?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_term_sheet_releases_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          bdt_state: Json | null
          benchmark: string | null
          bookrunners: Json
          business_day_convention: string | null
          common_code: string | null
          coupon: string
          created_at: string
          created_by_org: string | null
          currency: string
          cusip: string | null
          day_count_fraction: string | null
          extraction_snapshot: Json | null
          form_of_note: string | null
          governing_law: string | null
          guidance: string | null
          id: string
          interest_payment_frequency: string | null
          interest_rate: string | null
          interest_type: string | null
          ipt: string | null
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
          reference_rate: string | null
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
          bdt_state?: Json | null
          benchmark?: string | null
          bookrunners?: Json
          business_day_convention?: string | null
          common_code?: string | null
          coupon: string
          created_at?: string
          created_by_org?: string | null
          currency: string
          cusip?: string | null
          day_count_fraction?: string | null
          extraction_snapshot?: Json | null
          form_of_note?: string | null
          governing_law?: string | null
          guidance?: string | null
          id: string
          interest_payment_frequency?: string | null
          interest_rate?: string | null
          interest_type?: string | null
          ipt?: string | null
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
          reference_rate?: string | null
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
          bdt_state?: Json | null
          benchmark?: string | null
          bookrunners?: Json
          business_day_convention?: string | null
          common_code?: string | null
          coupon?: string
          created_at?: string
          created_by_org?: string | null
          currency?: string
          cusip?: string | null
          day_count_fraction?: string | null
          extraction_snapshot?: Json | null
          form_of_note?: string | null
          governing_law?: string | null
          guidance?: string | null
          id?: string
          interest_payment_frequency?: string | null
          interest_rate?: string | null
          interest_type?: string | null
          ipt?: string | null
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
          reference_rate?: string | null
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
          bulletin_source: string | null
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
          bulletin_source?: string | null
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
          bulletin_source?: string | null
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
      pdf_annotations: {
        Row: {
          attachment_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          xfdf: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          xfdf: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          xfdf?: string
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
      sync_audit_log: {
        Row: {
          created_at: string
          details: Json | null
          error_message: string | null
          event_type: string
          id: string
          records_processed: number | null
          repo: string | null
          source: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          event_type: string
          id?: string
          records_processed?: number | null
          repo?: string | null
          source: string
          status: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          event_type?: string
          id?: string
          records_processed?: number | null
          repo?: string | null
          source?: string
          status?: string
          triggered_by?: string | null
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
      can_access_deal: { Args: { _deal_id: string }; Returns: boolean }
      copilot_amount_cache: {
        Args: { amount: string; currency: string; fallback: string }
        Returns: string
      }
      copilot_claim: {
        Args: { _run: string; _token: string }
        Returns: boolean
      }
      copilot_complete: {
        Args: { _report: Json; _run: string; _token: string }
        Returns: boolean
      }
      copilot_context: { Args: { _deal: string }; Returns: Json }
      copilot_decide: {
        Args: { _approve: boolean; _change: string }
        Returns: string
      }
      copilot_editor: { Args: { _deal: string }; Returns: boolean }
      copilot_enqueue: {
        Args: { _document?: string; _thread: string }
        Returns: undefined
      }
      copilot_member: { Args: { _deal: string }; Returns: boolean }
      copilot_open: { Args: { _deal: string }; Returns: string }
      copilot_propose: {
        Args: {
          _after: string
          _before: string
          _field: string
          _reason: string
          _thread: string
        }
        Returns: undefined
      }
      copilot_register_document: {
        Args: { _document: string; _text: string; _thread: string }
        Returns: string
      }
      copilot_review_saved_terms: { Args: { _deal: string }; Returns: string }
      copilot_tenor_cache: {
        Args: { fallback: string; maturity: string; start_date: string }
        Returns: string
      }
      current_app_user_ids: { Args: never; Returns: string[] }
      current_user_org: { Args: never; Returns: string }
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
      is_approved: { Args: { uid: string }; Returns: boolean }
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
