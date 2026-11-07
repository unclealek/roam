import type { RewardDashboard } from "./types";
import type { RewardNotice } from "./presentation";
type Checkpoint = { xp: number; level: number; keys: string[] };
type Store = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
/** Presentation acknowledgment only. Never awards, predicts or persists reward content. */
export function createRewardAcknowledgments(store: Store) {
  const checkpoints = new Map<string, Checkpoint>();
  const pending = new Map<string, Promise<unknown>>();
  async function update(
    user: string,
    data: RewardDashboard,
  ): Promise<RewardNotice[]> {
    if (
      !data.progress ||
      !Number.isFinite(data.progress.total_xp) ||
      !Number.isFinite(data.progress.level)
    )
      return [];
    const key = `roam.reward-ack.v1.${user}`;
    let before = checkpoints.get(user);
    if (!before) {
      try {
        const raw = await store.getItem(key);
        const value = raw ? JSON.parse(raw) : null;
        if (
          value &&
          Number.isFinite(value.xp) &&
          value.xp >= 0 &&
          Number.isFinite(value.level) &&
          value.level >= 1 &&
          Array.isArray(value.keys) &&
          value.keys.every((k: unknown) => typeof k === "string")
        )
          before = value;
      } catch {
        /* Storage failure must not interrupt gameplay. */
      }
    }
    const keys = new Set(before?.keys ?? []);
    const notices: RewardNotice[] = [];
    if (before && data.progress.total_xp > before.xp)
      notices.push({
        key: `xp:${data.progress.total_xp}`,
        kind: "xp",
        text: `+${data.progress.total_xp - before.xp} XP earned`,
      });
    if (before && data.progress.level > before.level)
      notices.push({
        key: `level:${data.progress.level}`,
        kind: "level",
        text: `Level ${data.progress.level} reached`,
      });
    for (const card of data.collectibles)
      if (card.unlocked_at) {
        const id = `card:${card.id}`;
        if (before && !keys.has(id))
          notices.push({
            key: id,
            kind: "card",
            text: `${card.name} card unlocked`,
          });
        keys.add(id);
      }
    for (const achievement of data.achievements)
      if (achievement.earned_id) {
        const id = `achievement:${achievement.earned_id}`;
        if (before && !keys.has(id))
          notices.push({
            key: id,
            kind: "achievement",
            text: `Achievement earned: ${achievement.name}`,
          });
        keys.add(id);
      }
    const next = {
      xp: Math.max(before?.xp ?? 0, data.progress.total_xp),
      level: Math.max(before?.level ?? 1, data.progress.level),
      keys: [...keys],
    };
    checkpoints.set(user, next);
    try {
      await store.setItem(key, JSON.stringify(next));
    } catch {
      /* Memory deduplication still applies for this runtime. */
    }
    return notices;
  }
  return {
    observe(user: string, data: RewardDashboard): Promise<RewardNotice[]> {
      const next = (pending.get(user) ?? Promise.resolve())
        .catch(() => {})
        .then(() => update(user, data));
      pending.set(user, next);
      return next;
    },
  };
}
