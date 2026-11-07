import { it, expect } from "vitest";
import { createRewardAcknowledgments } from "../src/platform/rewards/acknowledgments";
import type { RewardDashboard } from "../src/platform/rewards/types";
const dashboard = (xp = 0, level = 1) =>
  ({
    progress: { total_xp: xp, level },
    collectibles: [],
    achievements: [],
    history: [],
    game_progress: [],
  }) as unknown as RewardDashboard;
it("seeds silently and acknowledges each confirmed change before presentation", async () => {
  const saved = new Map<string, string>();
  const store = {
    getItem: async (k: string) => saved.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      saved.set(k, v);
    },
  };
  const ack = createRewardAcknowledgments(store);
  expect(await ack.observe("alice", dashboard())).toEqual([]);
  expect(
    (await ack.observe("alice", dashboard(100, 2))).map((n) => n.kind),
  ).toEqual(["xp", "level"]);
  expect(await ack.observe("alice", dashboard(100, 2))).toEqual([]);
  expect(
    await createRewardAcknowledgments(store).observe(
      "alice",
      dashboard(100, 2),
    ),
  ).toEqual([]);
  expect(await ack.observe("bob", dashboard(100, 2))).toEqual([]);
});
it("does not replay when stale responses arrive out of order or parallel delivery repeats", async () => {
  const ack = createRewardAcknowledgments({
    getItem: async () => null,
    setItem: async () => {},
  });
  await ack.observe("alice", dashboard());
  const results = await Promise.all([
    ack.observe("alice", dashboard(100, 2)),
    ack.observe("alice", dashboard(100, 2)),
  ]);
  expect(results.flat().length).toBe(2);
  expect(await ack.observe("alice", dashboard(0, 1))).toEqual([]);
  expect(await ack.observe("alice", dashboard(100, 2))).toEqual([]);
});
it("unlocks only confirmed cards and achievement instances and persists acknowledgment", async () => {
  const ack = createRewardAcknowledgments({
    getItem: async () => null,
    setItem: async () => {},
  });
  await ack.observe("alice", dashboard());
  const next = {
    ...dashboard(),
    collectibles: [
      { id: "card", name: "First Steps", unlocked_at: "2030-01-01" },
    ],
    achievements: [
      {
        id: "first",
        earned_id: "earned",
        name: "First Game",
        unlocked_at: "2030-01-01",
      },
    ],
  } as unknown as RewardDashboard;
  expect((await ack.observe("alice", next)).map((n) => n.kind)).toEqual([
    "card",
    "achievement",
  ]);
  expect(await ack.observe("alice", next)).toEqual([]);
});
it("degrades to account-scoped memory if acknowledgment storage is unavailable", async () => {
  const ack = createRewardAcknowledgments({
    getItem: async () => {
      throw Error();
    },
    setItem: async () => {
      throw Error();
    },
  });
  await ack.observe("alice", dashboard());
  expect((await ack.observe("alice", dashboard(20))).length).toBe(1);
  expect(await ack.observe("alice", dashboard(20))).toEqual([]);
});
it("reads persisted acknowledgments and ignores corrupted storage without inventing celebrations", async () => {
  let raw = JSON.stringify({ xp: 100, level: 2, keys: ["card:first_steps"] });
  const store = {
    getItem: async () => raw,
    setItem: async (_key: string, value: string) => {
      raw = value;
    },
  };
  const current = {
    ...dashboard(100, 2),
    collectibles: [
      { id: "first_steps", name: "First Steps", unlocked_at: "2030-01-01" },
    ],
  } as unknown as RewardDashboard;
  expect(
    await createRewardAcknowledgments(store).observe("alice", current),
  ).toEqual([]);
  raw = "not-json";
  const fresh = createRewardAcknowledgments(store);
  expect(await fresh.observe("alice", current)).toEqual([]);
  expect(await fresh.observe("alice", dashboard(50, 1))).toEqual([]);
  expect(await fresh.observe("alice", {} as RewardDashboard)).toEqual([]);
});
