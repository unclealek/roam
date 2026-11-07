// @vitest-environment jsdom
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { RewardMotion } from "../src/presentation/rewards/RewardMotion";
const mock = vi.hoisted(() => ({
  reduced: false,
  timing: vi.fn((value: number) => value),
  cancel: vi.fn(),
}));
vi.mock("react-native-reanimated", async () => {
  const react = await import("react");
  return {
    default: {
      View: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      ),
    },
    ReduceMotion: { System: "system" },
    useReducedMotion: () => mock.reduced,
    useSharedValue: (value: number) => react.useMemo(() => ({ value }), []),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: mock.timing,
    cancelAnimation: mock.cancel,
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("uses a short animation and cancels when navigation removes it", () => {
  mock.reduced = false;
  const { unmount } = render(<RewardMotion>XP earned</RewardMotion>);
  expect(mock.timing).toHaveBeenCalledWith(1, {
    duration: 260,
    reduceMotion: "system",
  });
  unmount();
  expect(mock.cancel).toHaveBeenCalled();
});
it("respects reduced motion without delaying content", () => {
  mock.reduced = true;
  render(<RewardMotion>Card unlocked</RewardMotion>);
  expect(mock.timing).toHaveBeenCalledWith(1, {
    duration: 0,
    reduceMotion: "system",
  });
});
