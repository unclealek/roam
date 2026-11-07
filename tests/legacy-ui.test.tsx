// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Body, Button, Screen } from "../src/presentation/ui";
import { palettes } from "../src/presentation/brand/theme";
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("../src/presentation/brand/theme", async (original) => {
  const actual =
    await original<typeof import("../src/presentation/brand/theme")>();
  return {
    ...actual,
    useRoamTheme: () => ({
      colors: actual.palettes.dark,
      dark: true,
      ...actual.layout,
      type: actual.typography,
    }),
  };
});
vi.mock("expo-router", () => ({ router: {} }));
afterEach(cleanup);
it("uses semantic dark colors on authentication and fallback UI", () => {
  render(
    <Screen title="Signing in">
      <Body>Secure sign-in</Body>
      <Button label="Retry" onPress={() => {}} />
    </Screen>,
  );
  expect(screen.getByText("Secure sign-in").style.color).toBe(
    "rgb(185, 193, 203)",
  );
  expect(
    screen.getByRole("button", { name: "Retry" }).style.backgroundColor,
  ).toBe("rgb(49, 95, 145)");
  expect(palettes.dark.textSecondary).toBe("#B9C1CB");
});
