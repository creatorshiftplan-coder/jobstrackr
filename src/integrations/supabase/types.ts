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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_exam_discover_logs: {
        Row: {
          created_at: string
          id: string
          latency_ms: number | null
          parse_ok: boolean | null
          query: string
          raw_ai_response: Json | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          parse_ok?: boolean | null
          query: string
          raw_ai_response?: Json | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          latency_ms?: number | null
          parse_ok?: boolean | null
          query?: string
          raw_ai_response?: Json | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_job_discover_logs: {
        Row: {
          created_at: string
          id: string
          job_created: boolean | null
          latency_ms: number | null
          parse_ok: boolean | null
          query: string
          raw_ai_response: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_created?: boolean | null
          latency_ms?: number | null
          parse_ok?: boolean | null
          query: string
          raw_ai_response?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_created?: boolean | null
          latency_ms?: number | null
          parse_ok?: boolean | null
          query?: string
          raw_ai_response?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string | null
          file_url: string
          id: string
          ocr_result: Json | null
          ocr_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name?: string | null
          file_url: string
          id?: string
          ocr_result?: Json | null
          ocr_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string | null
          file_url?: string
          id?: string
          ocr_result?: Json | null
          ocr_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      education_qualifications: {
        Row: {
          board_university: string | null
          cgpa: number | null
          created_at: string | null
          date_of_passing: string | null
          id: string
          institute_name: string | null
          is_verified: boolean | null
          marks_obtained: number | null
          maximum_marks: number | null
          passing_year: number | null
          percentage: number | null
          qualification_name: string | null
          qualification_type: string
          roll_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          board_university?: string | null
          cgpa?: number | null
          created_at?: string | null
          date_of_passing?: string | null
          id?: string
          institute_name?: string | null
          is_verified?: boolean | null
          marks_obtained?: number | null
          maximum_marks?: number | null
          passing_year?: number | null
          percentage?: number | null
          qualification_name?: string | null
          qualification_type: string
          roll_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          board_university?: string | null
          cgpa?: number | null
          created_at?: string | null
          date_of_passing?: string | null
          id?: string
          institute_name?: string | null
          is_verified?: boolean | null
          marks_obtained?: number | null
          maximum_marks?: number | null
          passing_year?: number | null
          percentage?: number | null
          qualification_name?: string | null
          qualification_type?: string
          roll_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exam_attempts: {
        Row: {
          application_number: string | null
          created_at: string
          exam_id: string
          id: string
          notes: string | null
          password_encrypted: string | null
          roll_number: string | null
          status: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          application_number?: string | null
          created_at?: string
          exam_id: string
          id?: string
          notes?: string | null
          password_encrypted?: string | null
          roll_number?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          application_number?: string | null
          created_at?: string
          exam_id?: string
          id?: string
          notes?: string | null
          password_encrypted?: string | null
          roll_number?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          ai_cached_response: Json | null
          ai_last_updated_at: string | null
          ai_updated_by: string | null
          category: string | null
          conducting_body: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          official_website: string | null
          updated_at: string
        }
        Insert: {
          ai_cached_response?: Json | null
          ai_last_updated_at?: string | null
          ai_updated_by?: string | null
          category?: string | null
          conducting_body?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          official_website?: string | null
          updated_at?: string
        }
        Update: {
          ai_cached_response?: Json | null
          ai_last_updated_at?: string | null
          ai_updated_by?: string | null
          category?: string | null
          conducting_body?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          official_website?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          age_max: number | null
          age_min: number | null
          application_fee: number | null
          apply_link: string | null
          created_at: string
          department: string
          description: string | null
          eligibility: string | null
          experience: string | null
          id: string
          is_featured: boolean | null
          last_date: string
          last_date_display: string | null
          location: string
          qualification: string
          salary_max: number | null
          salary_min: number | null
          slug: string | null
          title: string
          updated_at: string
          vacancies: number | null
          vacancies_display: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          application_fee?: number | null
          apply_link?: string | null
          created_at?: string
          department: string
          description?: string | null
          eligibility?: string | null
          experience?: string | null
          id?: string
          is_featured?: boolean | null
          last_date: string
          last_date_display?: string | null
          location: string
          qualification: string
          salary_max?: number | null
          salary_min?: number | null
          slug?: string | null
          title: string
          updated_at?: string
          vacancies?: number | null
          vacancies_display?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          application_fee?: number | null
          apply_link?: string | null
          created_at?: string
          department?: string
          description?: string | null
          eligibility?: string | null
          experience?: string | null
          id?: string
          is_featured?: boolean | null
          last_date?: string
          last_date_display?: string | null
          location?: string
          qualification?: string
          salary_max?: number | null
          salary_min?: number | null
          slug?: string | null
          title?: string
          updated_at?: string
          vacancies?: number | null
          vacancies_display?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aadhar_number: string | null
          aadhar_number_encrypted: string | null
          address: string | null
          caste_certificate_number: string | null
          caste_issue_date: string | null
          caste_issuing_authority: string | null
          caste_name: string | null
          category: string | null
          created_at: string
          current_status: string | null
          date_of_birth: string | null
          disability_certificate_number: string | null
          disability_type: string | null
          email: string | null
          ews_certificate_number: string | null
          ews_issuing_authority: string | null
          father_name: string | null
          full_name: string | null
          gender: string | null
          id: string
          left_thumb_url: string | null
          marital_status: string | null
          mother_name: string | null
          pan_number: string | null
          pan_number_encrypted: string | null
          passport_number: string | null
          passport_number_encrypted: string | null
          phone: string | null
          photo_url: string | null
          pincode: string | null
          signature_url: string | null
          sub_category: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aadhar_number?: string | null
          aadhar_number_encrypted?: string | null
          address?: string | null
          caste_certificate_number?: string | null
          caste_issue_date?: string | null
          caste_issuing_authority?: string | null
          caste_name?: string | null
          category?: string | null
          created_at?: string
          current_status?: string | null
          date_of_birth?: string | null
          disability_certificate_number?: string | null
          disability_type?: string | null
          email?: string | null
          ews_certificate_number?: string | null
          ews_issuing_authority?: string | null
          father_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          left_thumb_url?: string | null
          marital_status?: string | null
          mother_name?: string | null
          pan_number?: string | null
          pan_number_encrypted?: string | null
          passport_number?: string | null
          passport_number_encrypted?: string | null
          phone?: string | null
          photo_url?: string | null
          pincode?: string | null
          signature_url?: string | null
          sub_category?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aadhar_number?: string | null
          aadhar_number_encrypted?: string | null
          address?: string | null
          caste_certificate_number?: string | null
          caste_issue_date?: string | null
          caste_issuing_authority?: string | null
          caste_name?: string | null
          category?: string | null
          created_at?: string
          current_status?: string | null
          date_of_birth?: string | null
          disability_certificate_number?: string | null
          disability_type?: string | null
          email?: string | null
          ews_certificate_number?: string | null
          ews_issuing_authority?: string | null
          father_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          left_thumb_url?: string | null
          marital_status?: string | null
          mother_name?: string | null
          pan_number?: string | null
          pan_number_encrypted?: string | null
          passport_number?: string | null
          passport_number_encrypted?: string | null
          phone?: string | null
          photo_url?: string | null
          pincode?: string | null
          signature_url?: string | null
          sub_category?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      update_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          source: string
          target_id: string | null
          target_table: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          source: string
          target_id?: string | null
          target_table?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          source?: string
          target_id?: string | null
          target_table?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      check_user_rate_limit:
      | { Args: { _daily_limit: number; _user_id: string }; Returns: Json }
      | {
        Args: {
          _daily_limit: number
          _minute_limit?: number
          _user_id: string
        }
        Returns: Json
      }
      decrypt_sensitive_field: {
        Args: { encrypted_value: string; owner_id: string }
        Returns: string
      }
      encrypt_sensitive_field: {
        Args: { field_value: string; owner_id: string }
        Returns: string
      }
      get_my_decrypted_profile: {
        Args: never
        Returns: {
          aadhar_number_decrypted: string
          full_name: string
          id: string
          pan_number_decrypted: string
          passport_number_decrypted: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
