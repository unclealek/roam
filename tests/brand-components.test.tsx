// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "./fixtures/brand-native-mocks";
import backgroundImage from "../assets/roam-background.jpg";
import { RoamMascot } from "../src/presentation/brand/RoamMascot";
import { RoamBackground } from "../src/presentation/brand/RoamBackground";
import { RoamButton } from "../src/presentation/brand/ui";
import { palettes } from "../src/presentation/brand/theme";
import { RoamIllustration } from "../src/presentation/icons";
import { GameCard } from "../src/presentation/games/GameCard";
import { MysteryGift } from "../src/presentation/secret-santa/SantaExperience";
import { gameRegistry } from "../src/platform/games/registry";
vi.mock("expo-router", () => ({ router: {} }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
afterEach(cleanup);
it("renders the explorer mascot accessibly", () => {
  const { container } = render(
    <RoamMascot size={300} placement="peek" animationState="entrance" />,
  );
  expect(screen.getByTestId("roam-mascot-entrance")).toBeTruthy();
  expect(container.querySelector("img")?.getAttribute("src")).toContain(
    "roam-mascot-explorer.png",
  );
  expect(screen.getByRole("img", { name: "Roam mascot" })).toBeTruthy();
});
it("a disabled provider action cannot trigger authentication", () => {
  const start = vi.fn();
  render(<RoamButton label="Continue with Google" disabled onPress={start} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  expect(start).not.toHaveBeenCalled();
});
it.each([
  "standard",
  "form",
  "home",
  "winter",
  "profile",
  "elevated",
  "celebration",
  "mystery",
] as const)(
  "renders the shared decorative image behind %s content",
  (variant) => {
    const { getByTestId, getByText } = render(
      <RoamBackground variant={variant}>
        <span>Screen content</span>
      </RoamBackground>,
    );
    const background = getByTestId(`roam-background-${variant}`);
    expect(background.querySelector("img")?.getAttribute("src")).toBe(
      backgroundImage,
    );
    expect(getByText("Screen content")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  },
);
it("uses the Home gift artwork in the catalog and Secret Santa flow", () => {
  const definition = gameRegistry.require("secret_santa");
  const home = render(<RoamIllustration name="secret-santa" />);
  const catalog = render(
    <GameCard game={{ definition, metadata: definition.metadata }} />,
  );
  const flow = render(<MysteryGift />);
  const artwork = home.container.querySelector("svg")!.innerHTML;

  expect(catalog.container.querySelector("svg")?.innerHTML).toBe(artwork);
  expect(flow.container.querySelector("svg")?.innerHTML).toBe(artwork);
});
it("supports readable text and action colors in both appearances", () => {
  const luminance = (hex: string) => {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((c) => parseInt(c, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const contrast = (a: string, b: string) => {
    const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (hi + 0.05) / (lo + 0.05);
  };
  for (const colors of Object.values(palettes)) {
    for (const surface of [
      colors.background,
      colors.surface,
      colors.surfaceElevated,
    ]) {
      expect(contrast(colors.textPrimary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.textSecondary, surface)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    expect(
      contrast(colors.onPrimary, colors.brandPrimary),
    ).toBeGreaterThanOrEqual(4.5);
  }
});
