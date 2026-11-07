import React from "react";
import { vi } from "vitest";
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
}));
vi.mock("react-native-reanimated", () => ({
  default: {
    View: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  },
  FadeOut: { duration: () => ({ reduceMotion: () => undefined }) },
  FadeIn: { duration: () => ({ reduceMotion: () => undefined }) },
  useReducedMotion: () => false,
  ReduceMotion: { System: "system" },
  useSharedValue: (value: number) => ({ value, set: vi.fn() }),
  useAnimatedStyle: () => ({}),
  withTiming: (value: number) => value,
}));

vi.mock("../../src/presentation/brand/useAccessibilityPreferences", () => ({
  useAccessibilityPreferences: () => ({
    reduceTransparency: false,
    increaseContrast: false,
  }),
}));

// The native SVG renderer is exercised by browser/native exports; unit tests inspect its contract.
vi.mock("react-native-svg", () => ({
  SvgXml: ({
    xml,
    width,
    height,
  }: {
    xml: string;
    width: number;
    height: number;
  }) => (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      dangerouslySetInnerHTML={{
        __html: xml.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, ""),
      }}
    />
  ),
}));
