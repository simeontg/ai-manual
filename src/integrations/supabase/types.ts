export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      checkins: {
        Row: {
          checked_in_at: string;
          checked_in_by: string;
          event_id: string;
          id: string;
          ticket_id: string;
        };
        Insert: {
          checked_in_at?: string;
          checked_in_by: string;
          event_id: string;
          id?: string;
          ticket_id: string;
        };
        Update: {
          checked_in_at?: string;
          checked_in_by?: string;
          event_id?: string;
          id?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkins_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkins_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: true;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      event_feedback: {
        Row: {
          comment: string | null;
          created_at: string;
          event_id: string;
          id: string;
          rating: number;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          rating: number;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          rating?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_photos: {
        Row: {
          approved: boolean;
          caption: string | null;
          created_at: string;
          event_id: string;
          id: string;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          approved?: boolean;
          caption?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          storage_path: string;
          user_id: string;
        };
        Update: {
          approved?: boolean;
          caption?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          capacity: number;
          cover_image_url: string | null;
          created_at: string;
          description: string | null;
          ends_at: string;
          host_id: string;
          host_org_id: string | null;
          id: string;
          is_paid: boolean;
          location: string | null;
          slug: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["event_status"];
          time_zone: string;
          title: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["event_visibility"];
        };
        Insert: {
          capacity?: number;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          host_id: string;
          host_org_id?: string | null;
          id?: string;
          is_paid?: boolean;
          location?: string | null;
          slug?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["event_status"];
          time_zone?: string;
          title: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
        };
        Update: {
          capacity?: number;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          host_id?: string;
          host_org_id?: string | null;
          id?: string;
          is_paid?: boolean;
          location?: string | null;
          slug?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["event_status"];
          time_zone?: string;
          title?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["event_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "events_host_org_id_fkey";
            columns: ["host_org_id"];
            isOneToOne: false;
            referencedRelation: "hosts";
            referencedColumns: ["id"];
          },
        ];
      };
      host_invites: {
        Row: {
          created_at: string;
          created_by: string;
          expires_at: string;
          host_id: string;
          id: string;
          role: Database["public"]["Enums"]["host_member_role"];
          token: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          expires_at?: string;
          host_id: string;
          id?: string;
          role?: Database["public"]["Enums"]["host_member_role"];
          token?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          host_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["host_member_role"];
          token?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "host_invites_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "hosts";
            referencedColumns: ["id"];
          },
        ];
      };
      host_members: {
        Row: {
          created_at: string;
          host_id: string;
          id: string;
          role: Database["public"]["Enums"]["host_member_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          host_id: string;
          id?: string;
          role?: Database["public"]["Enums"]["host_member_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          host_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["host_member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "host_members_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "hosts";
            referencedColumns: ["id"];
          },
        ];
      };
      hosts: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          slug: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          owner_id: string;
          slug?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          slug?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          contact_email: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          is_host: boolean;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          contact_email?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          is_host?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          contact_email?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          is_host?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          reason: string;
          reporter_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          reason: string;
          reporter_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id?: string;
          target_type?: Database["public"]["Enums"]["report_target"];
        };
        Relationships: [];
      };
      rsvps: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          status: Database["public"]["Enums"]["rsvp_status"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          status?: Database["public"]["Enums"]["rsvp_status"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          status?: Database["public"]["Enums"]["rsvp_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          event_id: string;
          id: string;
          qr_token: string;
          rsvp_id: string;
          user_id: string;
        };
        Insert: {
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          qr_token?: string;
          rsvp_id: string;
          user_id: string;
        };
        Update: {
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          qr_token?: string;
          rsvp_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_rsvp_id_fkey";
            columns: ["rsvp_id"];
            isOneToOne: true;
            referencedRelation: "rsvps";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          contact_email: string | null;
          display_name: string | null;
          id: string | null;
          is_host: boolean | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          contact_email?: string | null;
          display_name?: string | null;
          id?: string | null;
          is_host?: boolean | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          contact_email?: string | null;
          display_name?: string | null;
          id?: string | null;
          is_host?: boolean | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_host_invite: {
        Args: { _token: string };
        Returns: {
          out_host_id: string;
          out_role: Database["public"]["Enums"]["host_member_role"];
        }[];
      };
      get_event_attendee_email: {
        Args: { p_ticket_id: string };
        Returns: string;
      };
      get_event_attendee_emails: {
        Args: { p_event_id: string };
        Returns: {
          display_name: string;
          email: string;
          user_id: string;
        }[];
      };
      get_host_invite: {
        Args: { _token: string };
        Returns: {
          expires_at: string;
          host_name: string;
          id: string;
          role: Database["public"]["Enums"]["host_member_role"];
          used_at: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_event_checker: {
        Args: { _event_id: string; _user_id: string };
        Returns: boolean;
      };
      is_host_member: {
        Args: { _host_id: string; _user_id: string };
        Returns: boolean;
      };
      is_host_member_for_event: {
        Args: { _event_id: string; _user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "host" | "checker" | "attendee";
      event_status: "draft" | "published";
      event_visibility: "public" | "unlisted";
      host_member_role: "owner" | "manager" | "checker";
      report_status: "open" | "reviewed" | "dismissed";
      report_target: "event" | "photo";
      rsvp_status: "going" | "waitlist" | "cancelled" | "confirmed" | "waitlisted";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "host", "checker", "attendee"],
      event_status: ["draft", "published"],
      event_visibility: ["public", "unlisted"],
      host_member_role: ["owner", "manager", "checker"],
      report_status: ["open", "reviewed", "dismissed"],
      report_target: ["event", "photo"],
      rsvp_status: ["going", "waitlist", "cancelled", "confirmed", "waitlisted"],
    },
  },
} as const;
