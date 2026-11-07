import type { GameSession } from "../sessions/types";
export const groupIcons = {
  people: "👥",
  sparkles: "✨",
  coffee: "☕",
  planet: "🪐",
  heart: "💛",
} as const;
export type GroupInput = {
  name: string;
  description?: string | null;
  icon_key?: string | null;
};
export type GroupPreview = {
  id: string;
  name: string;
  description: string | null;
  icon_key: string | null;
  member_count: number;
};
export type Group = GroupPreview & {
  owner_id: string;
  vice_owner_id?: string | null;
  created_at: string;
  updated_at: string;
};
export type GroupMember = {
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  joined_at: string;
};
export type GroupInvite = {
  id: string;
  group_id: string;
  expires_at: string | null;
  revoked_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
};
export type GroupDetails = Group & {
  members: GroupMember[];
  sessions: GameSession[];
  invites: GroupInvite[];
};
export type NewInvite = GroupInvite & { code: string };
