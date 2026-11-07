import type { GameSession } from "./sessions/types";
import type { GameMetadata } from "./games/types";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
/** Local schema contract. Regenerate from the selected backend after deployment. */
export type Database = {
  public: {
    Tables: {
      xp_transactions: {
        Row: import("./rewards/types").XpTransaction;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      collectible_cards: {
        Row: import("./rewards/types").CollectibleCard;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      achievement_definitions: {
        Row: import("./rewards/types").AchievementDefinition;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      level_thresholds: {
        Row: { level: number; xp_required: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reward_definitions: {
        Row: {
          id: string;
          event_key: import("./rewards/types").RewardEventKey;
          game_type_id: string | null;
          xp_amount: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_collectibles: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          game_session_id: string | null;
          unlocked_at: string;
          source_event_key: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          game_session_id: string | null;
          scope_key: string;
          unlocked_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      scheduled_activities: {
        Row: import("./activities/types").Activity;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_notifications: {
        Row: import("./notifications/types").UserNotification;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      notification_preferences: {
        Row: import("./notifications/types").NotificationPreferences;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      groups: {
        Row: Omit<import("./groups/types").Group, "member_count">;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: "owner" | "member";
          joined_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      group_invites: {
        Row: {
          id: string;
          group_id: string;
          code_hash: string;
          created_by: string | null;
          expires_at: string | null;
          revoked_at: string | null;
          max_uses: number | null;
          use_count: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: { display_name?: string };
        Relationships: [];
      };
      game_types: {
        Row: GameMetadata & {
          id: string;
          configuration_schema: Json;
          lifecycle_operations: string[];
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      game_sessions: {
        Row: GameSession & {
          creation_request_id: string;
          creation_fingerprint: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      game_session_members: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          joined_at: string;
          role: "host" | "member";
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      submit_safety_report: {
        Args: {
          p_group_id: string;
          p_user_id: string | null;
          p_reason: string;
          p_description: string | null;
        };
        Returns: undefined;
      };
      reward_account: {
        Args: { p_action: string; p_data?: Json };
        Returns: Json;
      };
      notification_account: {
        Args: { p_action: string; p_data?: Json };
        Returns: Json;
      };
      secret_santa_lobby: {
        Args: { p_action: string; p_session_id?: string | null; p_data?: Json };
        Returns: Json;
      };
      create_group: {
        Args: {
          p_name: string;
          p_description: string | null;
          p_icon_key: string | null;
        };
        Returns: Json;
      };
      list_my_groups: { Args: Record<string, never>; Returns: Json };
      get_group: { Args: { p_group_id: string }; Returns: Json };
      update_group: {
        Args: {
          p_group_id: string;
          p_name: string;
          p_description: string | null;
          p_icon_key: string | null;
        };
        Returns: Json;
      };
      leave_group: { Args: { p_group_id: string }; Returns: Json };
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: Json;
      };
      transfer_group_ownership: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: Json;
      };
      set_group_vice_owner: {
        Args: { p_group_id: string; p_user_id: string | null };
        Returns: Json;
      };
      delete_group: { Args: { p_group_id: string }; Returns: Json };
      create_group_invite: {
        Args: { p_group_id: string; p_days: number; p_max_uses: number | null };
        Returns: Json;
      };
      revoke_group_invite: {
        Args: { p_group_id: string; p_invite_id: string };
        Returns: Json;
      };
      preview_group_invite: { Args: { p_code: string }; Returns: Json };
      redeem_group_invite: { Args: { p_code: string }; Returns: Json };
      create_group_game_session: {
        Args: {
          p_group_id: string;
          p_game_type_id: string;
          p_name: string;
          p_configuration: Json;
          p_request_id: string;
        };
        Returns: Json;
      };
      create_game_session: {
        Args: {
          p_game_type_id: string;
          p_name: string;
          p_configuration: Json;
          p_request_id: string;
        };
        Returns: Json;
      };
      get_game_session: { Args: { p_session_id: string }; Returns: Json };
      list_my_game_sessions: { Args: Record<string, never>; Returns: Json };
      update_game_session: {
        Args: { p_session_id: string; p_name: string; p_configuration: Json };
        Returns: Json;
      };
      join_game_session: { Args: { p_session_id: string }; Returns: Json };
      leave_game_session: { Args: { p_session_id: string }; Returns: Json };
      start_game_session: { Args: { p_session_id: string }; Returns: Json };
      cancel_game_session: { Args: { p_session_id: string }; Returns: Json };
      open_game_lobby: { Args: { p_session_id: string }; Returns: Json };
      delete_own_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
