// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import RewardsScreen from "../src/presentation/rewards/RewardsScreen";
import CardDetailScreen from "../src/presentation/rewards/CardDetailScreen";
const mock = vi.hoisted(() => ({
  data: null as unknown,
  loading: false,
  error: null as string | null,
  push: vi.fn(),
  navigate: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("expo-router", () => ({
  router: {
    push: mock.push,
    navigate: mock.navigate,
    dismissTo: mock.navigate,
  },
  useLocalSearchParams: () => ({ cardId: "first_steps" }),
  useFocusEffect: () => {},
}));
vi.mock("../src/platform/auth/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: "alice" } } }),
}));
vi.mock("../src/platform/sessions/useAccountResource", () => ({
  useAccountResource: () => ({
    data: mock.data,
    loading: mock.loading,
    error: mock.error,
    refresh: mock.refresh,
  }),
}));
vi.mock("../src/platform/rewards/service", () => ({
  getRewardDashboard: vi.fn(),
  getRewardHistory: vi.fn(),
  getCard: vi.fn(),
}));
vi.mock("../src/presentation/rewards/RewardMotion", () => ({
  RewardMotion: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
const card = {
  id: "first_steps",
  name: "First Steps",
  description: "Your first shared adventure.",
  rarity: "common",
  artwork_key: "first_steps",
  unlock_rule: { description: "Complete your first game." },
  unlocked_at: null,
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mock.loading = false;
  mock.error = null;
});
it("shows real zero progression and locked cards without invented rewards", () => {
  mock.data = {
    progress: { level: 1, total_xp: 0, xp_to_next_level: 100, progress: 0 },
    game_progress: [],
    collectibles: [card],
    achievements: [],
    history: [],
  };
  render(<RewardsScreen />);
  expect(screen.getByText("Level 1")).toBeTruthy();
  expect(screen.getByText("0 XP")).toBeTruthy();
  expect(screen.getByText("100 XP to level 2")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "View First Steps card, locked" }),
  );
  expect(mock.push).toHaveBeenCalledWith({
    pathname: "/collectible/[cardId]",
    params: { cardId: "first_steps" },
  });
});
it("shows card conditions, rarity, locked state and earned date from server data", () => {
  mock.data = card;
  const result = render(<CardDetailScreen />);
  expect(screen.getByText("Complete your first game.")).toBeTruthy();
  expect(screen.getByText("common")).toBeTruthy();
  expect(screen.getByText("Locked", { exact: true })).toBeTruthy();
  mock.data = { ...card, unlocked_at: "2026-10-27T12:00:00Z" };
  result.rerender(<CardDetailScreen />);
  expect(screen.getByText(/Earned /)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back to rewards" }));
  expect(mock.navigate).toHaveBeenCalledWith("/rewards");
});
it("shows loading, recoverable failures and unknown-card empty states", () => {
  mock.loading = true;
  const result = render(<RewardsScreen />);
  expect(screen.getByText("Loading your rewards…")).toBeTruthy();
  mock.loading = false;
  mock.error = "Connection failed";
  result.rerender(<RewardsScreen />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(mock.refresh).toHaveBeenCalled();
  cleanup();
  mock.error = null;
  mock.data = null;
  render(<CardDetailScreen />);
  expect(screen.getByText("Card not found")).toBeTruthy();
});
it("announces real progress changes without replaying past unlocks on initial load", async () => {
  const before = {
    progress: { level: 1, total_xp: 0, xp_to_next_level: 100, progress: 0 },
    game_progress: [],
    collectibles: [card],
    achievements: [],
    history: [],
  };
  mock.data = before;
  const result = render(<RewardsScreen />);
  mock.data = {
    ...before,
    progress: { level: 2, total_xp: 100, xp_to_next_level: 150, progress: 0 },
    collectibles: [{ ...card, unlocked_at: "utc" }],
    achievements: [
      {
        id: "first",
        earned_id: "new",
        name: "First game",
        description: "Complete your first game",
        unlocked_at: "utc",
      },
    ],
  };
  result.rerender(<RewardsScreen />);
  await waitFor(() => expect(screen.getByText("+100 XP earned")).toBeTruthy());
  expect(screen.getByText("Level 2 reached")).toBeTruthy();
  expect(screen.getByText("First Steps card unlocked")).toBeTruthy();
  expect(screen.getByText("Achievement earned: First game")).toBeTruthy();
});
