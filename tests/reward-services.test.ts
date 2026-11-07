import { beforeEach, expect, it, vi } from "vitest";
import {
  getPlayerProgress,
  getGameProgress,
  getPlayerCollectibles,
  getCard,
  getAchievements,
  getRewardHistory,
  getRewardDashboard,
} from "../src/platform/rewards/service";
import { rewardService } from "../supabase/functions/_shared/rewards";
import { rewardChanges } from "../src/platform/rewards/presentation";
import { notificationRoute } from "../src/platform/notifications/routes";
import type { RewardDashboard } from "../src/platform/rewards/types";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../src/platform/supabase", () => ({
  requireSupabase: () => ({ rpc: mock.rpc }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.rpc.mockResolvedValue({ data: [], error: null });
});
it("uses read-only authenticated RPCs for every player projection and paginates history", async () => {
  await getPlayerProgress();
  await getGameProgress();
  await getGameProgress("game", "session");
  await getPlayerCollectibles();
  await getCard("first_steps");
  await getAchievements();
  await getRewardHistory();
  await getRewardHistory({ id: "last", created_at: "utc" });
  await getRewardDashboard();
  expect(mock.rpc).toHaveBeenCalledWith("reward_account", {
    p_action: "game_progress",
    p_data: { game_type_id: "game", session_id: "session" },
  });
  expect(mock.rpc).toHaveBeenCalledWith("reward_account", {
    p_action: "history",
    p_data: { before_id: "last", before_created_at: "utc" },
  });
  expect(mock.rpc.mock.calls.every((c) => c[0] === "reward_account")).toBe(
    true,
  );
  mock.rpc.mockResolvedValue({
    error: { message: "private database information" },
  });
  await expect(getPlayerProgress()).rejects.toThrow(
    "Unable to load rewards. Please try again.",
  );
});
it("passes evidence references to the trusted service, never arbitrary XP or client deduplication keys", async () => {
  const api = rewardService(mock.rpc);
  await api.awardXpForEvent({
    userId: "user",
    event: "session_finished",
    sessionId: "session",
  });
  expect(mock.rpc).toHaveBeenLastCalledWith("award_xp_for_event", {
    p_user: "user",
    p_event: "session_finished",
    p_session: "session",
    p_source: null,
  });
  await api.awardXpForEvent({
    userId: "user",
    event: "activity_completed",
    sessionId: "session",
    sourceId: "activity",
  });
  await api.evaluateAchievements("user");
  await api.evaluateAchievements("user", "session");
  await api.unlockCollectible("user", "first_steps");
  await api.unlockCollectible("user", "first_steps", "session");
  expect(mock.rpc).toHaveBeenLastCalledWith("unlock_collectible", {
    p_user: "user",
    p_card: "first_steps",
    p_session: "session",
  });
  mock.rpc.mockResolvedValue({ error: true });
  await expect(api.evaluateAchievements("user")).rejects.toThrow(
    "Reward operation failed",
  );
});
it("detects only newly earned XP, levels, cards and achievements and allows the protected rewards link", () => {
  const before = {
    progress: { total_xp: 0, level: 1 },
    collectibles: [],
    achievements: [],
  } as unknown as RewardDashboard;
  const after = {
    progress: { total_xp: 100, level: 2 },
    collectibles: [
      { id: "first_steps", name: "First Steps", unlocked_at: "utc" },
    ],
    achievements: [
      { id: "first_game", earned_id: "earned", name: "First game" },
    ],
  } as unknown as RewardDashboard;
  expect(rewardChanges(null, after)).toEqual([]);
  expect(rewardChanges(before, after).map((n) => n.kind)).toEqual([
    "xp",
    "level",
    "card",
    "achievement",
  ]);
  expect(rewardChanges(after, after)).toEqual([]);
  expect(notificationRoute("/rewards")).toBe("/rewards");
  expect(notificationRoute("/rewards?award=1000")).toBeNull();
});
