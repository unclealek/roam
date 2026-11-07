/** Server-only facade. It accepts evidence references, never XP amounts or client
 * idempotency keys. SQL verifies actual state using migration-registered validators. */
export type RewardEventKey =
  | "first_game_completed"
  | "activity_completed"
  | "mind_match_prediction_correct"
  | "secret_mission_completed"
  | "session_finished";
export type RewardEvent = {
  userId: string;
  event: RewardEventKey;
  sessionId: string;
  sourceId?: string;
};
export type RewardRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
export function rewardService(rpc: RewardRpc) {
  async function call<T>(name: string, args: Record<string, unknown>) {
    const result = await rpc(name, args);
    if (result.error) throw new Error("Reward operation failed");
    return result.data as T;
  }
  return {
    awardXpForEvent: (event: RewardEvent) =>
      call<{
        id?: string;
        amount?: number;
        duplicate?: boolean;
        skipped?: boolean;
        level?: number;
      }>("award_xp_for_event", {
        p_user: event.userId,
        p_event: event.event,
        p_session: event.sessionId,
        p_source: event.sourceId ?? null,
      }),
    evaluateAchievements: (userId: string, sessionId?: string) =>
      call<{ cards: number; achievements: number }>(
        "evaluate_reward_eligibility",
        { p_user: userId, p_session: sessionId ?? null },
      ),
    unlockCollectible: (userId: string, cardId: string, sessionId?: string) =>
      call<boolean>("unlock_collectible", {
        p_user: userId,
        p_card: cardId,
        p_session: sessionId ?? null,
      }),
  };
}
