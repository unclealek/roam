import type { RewardDashboard, RewardEventKey } from "./types";
export const eventLabels: Record<RewardEventKey, string> = {
  first_game_completed: "First game completed",
  activity_completed: "Activity completed",
  mind_match_prediction_correct: "Correct Mind Match prediction",
  secret_mission_completed: "Secret Mission completed",
  session_finished: "Game session finished",
};
export type RewardNotice = {
  key: string;
  kind: "xp" | "level" | "card" | "achievement";
  text: string;
};
export function rewardChanges(
  before: RewardDashboard | null,
  after: RewardDashboard,
): RewardNotice[] {
  if (!before) return [];
  const notices: RewardNotice[] = [];
  const xp = after.progress.total_xp - before.progress.total_xp;
  if (xp > 0)
    notices.push({
      key: `xp:${after.progress.total_xp}`,
      kind: "xp",
      text: `+${xp} XP earned`,
    });
  if (after.progress.level > before.progress.level)
    notices.push({
      key: `level:${after.progress.level}`,
      kind: "level",
      text: `Level ${after.progress.level} reached`,
    });
  const cards = new Set(
    before.collectibles.filter((c) => c.unlocked_at).map((c) => c.id),
  );
  for (const c of after.collectibles)
    if (c.unlocked_at && !cards.has(c.id))
      notices.push({
        key: `card:${c.id}`,
        kind: "card",
        text: `${c.name} card unlocked`,
      });
  const achievements = new Set(
    before.achievements.filter((a) => a.earned_id).map((a) => a.earned_id),
  );
  for (const a of after.achievements)
    if (a.earned_id && !achievements.has(a.earned_id))
      notices.push({
        key: `achievement:${a.earned_id}`,
        kind: "achievement",
        text: `Achievement earned: ${a.name}`,
      });
  return notices;
}
