export type Activity = {
  id: string;
  game_session_id: string;
  activity_type: string;
  target_user_id: string | null;
  payload: { template_key?: string };
  status: "scheduled" | "available" | "completed" | "expired" | "cancelled";
  unlock_at: string;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  idempotency_key: string;
};
