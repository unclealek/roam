import type { Configuration } from "../games/types";
export const sessionStatuses = [
  "draft",
  "lobby",
  "active",
  "completed",
  "cancelled",
  "failed",
] as const;
export type SessionStatus = (typeof sessionStatuses)[number];
export type GameSession = {
  id: string;
  game_type_id: string;
  host_id: string;
  group_id: string | null;
  name: string;
  configuration: Configuration;
  status: SessionStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};
export type SessionSummary = GameSession & { participant_count: number };
export type SessionMember = {
  id: string;
  user_id: string;
  display_name: string;
  role: "host" | "member";
  joined_at: string;
};
export type SessionDetails = SessionSummary & {
  host: { id: string; display_name: string };
  participants: SessionMember[];
};
