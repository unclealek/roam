import { requireSupabase } from "../supabase";
import type { Json } from "../database.types";
import type {
  PlayerProgress,
  GameProgress,
  PlayerCard,
  PlayerAchievement,
  XpTransaction,
  RewardDashboard,
} from "./types";
async function read<T>(action: string, data: Json = {}) {
  const result = await requireSupabase().rpc("reward_account", {
    p_action: action,
    p_data: data,
  });
  if (result.error)
    throw new Error("Unable to load rewards. Please try again.");
  return result.data as T;
}
export const getPlayerProgress = () => read<PlayerProgress>("progress");
export const getGameProgress = (gameTypeId?: string, sessionId?: string) =>
  read<GameProgress[]>("game_progress", {
    ...(gameTypeId ? { game_type_id: gameTypeId } : {}),
    ...(sessionId ? { session_id: sessionId } : {}),
  });
export const getPlayerCollectibles = () => read<PlayerCard[]>("collectibles");
export const getCard = (cardId: string) =>
  read<PlayerCard | null>("card", { card_id: cardId });
export const getAchievements = () => read<PlayerAchievement[]>("achievements");
export const getRewardHistory = (
  before?: Pick<XpTransaction, "created_at" | "id">,
) =>
  read<XpTransaction[]>(
    "history",
    before
      ? { before_created_at: before.created_at, before_id: before.id }
      : {},
  );
export const getRewardDashboard = () => read<RewardDashboard>("dashboard");
