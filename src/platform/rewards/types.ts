export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type RewardEventKey =
  | "first_game_completed"
  | "activity_completed"
  | "mind_match_prediction_correct"
  | "secret_mission_completed"
  | "session_finished";
export type Rule = {
  kind: string;
  count?: number;
  key?: string;
  description?: string;
};
export type PlayerProgress = {
  total_xp: number;
  level: number;
  level_xp: number;
  next_level_xp: number | null;
  xp_into_level: number;
  xp_to_next_level: number | null;
  progress: number;
};
export type GameProgress = {
  game_type_id: string;
  game_name: string;
  total_xp: number;
};
export type CollectibleCard = {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  artwork_key: string;
  game_type_id: string | null;
  unlock_rule: Rule;
  created_at: string;
};
export type PlayerCard = CollectibleCard & {
  owned_id: string | null;
  unlocked_at: string | null;
  earned_session_id: string | null;
};
export type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  game_type_id: string | null;
  scope: "global" | "game" | "session";
  criteria: Rule;
  created_at: string;
};
export type PlayerAchievement = AchievementDefinition & {
  earned_id: string | null;
  unlocked_at: string | null;
  game_session_id: string | null;
};
export type XpTransaction = {
  id: string;
  user_id: string;
  game_session_id: string | null;
  game_type_id: string | null;
  reward_definition_id: string;
  amount: number;
  idempotency_key: string;
  source_event_key: RewardEventKey;
  source_id: string;
  source_session_id: string;
  created_at: string;
};
export type RewardDashboard = {
  progress: PlayerProgress;
  game_progress: GameProgress[];
  collectibles: PlayerCard[];
  achievements: PlayerAchievement[];
  history: XpTransaction[];
};
