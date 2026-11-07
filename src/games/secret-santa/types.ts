import type { SessionDetails } from "../../platform/sessions/types";
export type SantaConfig = {
  description?: string | null;
  joining_deadline: string;
  exchange_date: string;
  exchange_timezone: string;
  budget_amount?: number | null;
  currency_code: string;
  identity_reveal_enabled: boolean;
  mind_match_enabled: boolean;
  secret_agent_enabled: boolean;
  secret_missions_enabled: boolean;
  max_participants: number;
};
export type SantaSettings = SantaConfig & {
  session_id: string;
  joining_closed_at: string | null;
  lobby_phase:
    | "joining_open"
    | "joining_closed"
    | "ready_for_draw"
    | "insufficient_players"
    | "drawing"
    | "matched"
    | "draw_failed";
  matched_at?: string | null;
  recovery_required?: boolean;
  created_at: string;
  updated_at: string;
};
export type SessionInvite = {
  id: string;
  session_id: string;
  expires_at: string;
  revoked_at: string | null;
  use_count: number;
  code?: string;
};
export type SantaLobby = SessionDetails & {
  settings: SantaSettings;
  server_now: string;
  invitations: SessionInvite[];
  invitation?: SessionInvite;
};
export type SantaPreview = {
  id: string;
  name: string;
  participant_count: number;
  joining_deadline: string;
  exchange_date?: string;
  preview?: boolean;
  can_join?: boolean;
};

export type SantaAssignment = {
  session_id: string;
  name: string;
  status: string;
  settings: SantaSettings;
  server_now: string;
  revealed_at: string | null;
  recipient: { display_name: string; available: boolean } | null;
};
