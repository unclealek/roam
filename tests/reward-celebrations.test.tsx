// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { RewardCelebration } from "../src/presentation/rewards/RewardEngagement";
import type { RewardDashboard } from "../src/platform/rewards/types";
vi.mock("../src/presentation/rewards/RewardMotion", () => ({
  RewardMotion: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("expo-router", () => ({ router: {}, useFocusEffect: () => {} }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
const data = {
  progress: { level: 2, total_xp: 100 },
  collectibles: [
    {
      id: "first_steps",
      name: "First Steps",
      rarity: "common",
      description: "A moment worth keeping.",
      artwork_key: "first_steps",
      unlocked_at: "2030-01-01",
    },
  ],
  achievements: [],
  history: [],
  game_progress: [],
} as unknown as RewardDashboard;
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("conceals confirmed collectible artwork until the reveal action and allows dismissal", () => {
  const dismiss = vi.fn();
  render(
    <RewardCelebration
      notice={{
        key: "card:first_steps",
        kind: "card",
        text: "First Steps card unlocked",
      }}
      data={data}
      onDismiss={dismiss}
    />,
  );
  expect(screen.getByLabelText("Locked collectible artwork")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reveal First Steps" }));
  expect(screen.getByLabelText("Collectible artwork")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(dismiss).toHaveBeenCalledOnce();
});
it("XP feedback expires without blocking navigation or creating an award", () => {
  vi.useFakeTimers();
  const dismiss = vi.fn();
  render(
    <RewardCelebration
      notice={{ key: "xp:100", kind: "xp", text: "+20 XP earned" }}
      data={data}
      onDismiss={dismiss}
    />,
  );
  expect(screen.getByText("+20 XP earned")).toBeTruthy();
  act(() => vi.advanceTimersByTime(5000));
  expect(dismiss).toHaveBeenCalledOnce();
});
it("level celebrations can be continued immediately", () => {
  const dismiss = vi.fn();
  render(
    <RewardCelebration
      notice={{ key: "level:2", kind: "level", text: "Level 2 reached" }}
      data={data}
      onDismiss={dismiss}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(dismiss).toHaveBeenCalledOnce();
});
it("hides celebrations in the background and releases critical banner suppression", async () => {
  const { AppState } = await import("react-native");
  const { foregroundPresentationSuppressed, setForegroundRouteSuppressed } =
    await import("../src/platform/notifications/presentation");
  setForegroundRouteSuppressed(false);
  let change: (state: import("react-native").AppStateStatus) => void = () => {};
  const listener = vi
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, callback) => {
      change = callback;
      return { remove: () => {} };
    });
  const view = render(
    <RewardCelebration
      notice={{ key: "level:2", kind: "level", text: "Level 2 reached" }}
      data={data}
      onDismiss={() => {}}
    />,
  );
  expect(foregroundPresentationSuppressed()).toBe(true);
  act(() => change("background"));
  expect(screen.queryByText("Level 2 reached")).toBeNull();
  expect(foregroundPresentationSuppressed()).toBe(false);
  view.unmount();
  listener.mockRestore();
});
