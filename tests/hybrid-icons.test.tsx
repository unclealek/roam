// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "./fixtures/brand-native-mocks";
import {
  RoamIcon,
  FunctionalIcon,
  RoamIllustration,
  AchievementBadge,
} from "../src/presentation/icons";
import {
  originalIcons,
  navigationIconNames,
  resolveAchievementIcon,
  resolveGameIcon,
} from "../src/presentation/icons/registry";
import { iconTokens } from "../src/presentation/icons/iconTokens";
import { illustrationManifest } from "../src/presentation/icons/illustrations";
afterEach(cleanup);
it("labels meaningful icons and hides decorative ones", () => {
  render(
    <>
      <RoamIcon name="home" label="Roam Home" />
      <RoamIcon name="groups" />
      <FunctionalIcon name="search" label="Search groups" />
    </>,
  );
  expect(screen.getByRole("img", { name: "Roam Home" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Search groups" })).toBeTruthy();
  expect(screen.getAllByRole("img")).toHaveLength(2);
});
it("has five distinct original navigation silhouettes with selected states", () => {
  expect(navigationIconNames).toHaveLength(5);
  expect(
    new Set(navigationIconNames.map((name) => originalIcons[name].body)).size,
  ).toBe(5);
  const { container, rerender } = render(
    <RoamIcon name="home" size={24} variant="inactive" label="Home" />,
  );
  const inactive = container.innerHTML;
  rerender(<RoamIcon name="home" size={24} variant="active" label="Home" />);
  expect(container.innerHTML).not.toBe(inactive);
  expect(container.querySelector("svg")?.getAttribute("width")).toBe("24");
});
it("preserves achievement identity in locked and progress states", () => {
  const { rerender } = render(
    <AchievementBadge
      name="team-player"
      state="locked"
      size={80}
      label="Team Player locked"
    />,
  );
  expect(screen.getByRole("img", { name: "Team Player locked" })).toBeTruthy();
  rerender(
    <AchievementBadge
      name="team-player"
      state="progress"
      progress={0.4}
      label="Team Player progress"
    />,
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "40",
  );
});
it("uses explicit mappings for current server artwork keys and safe future fallbacks", () => {
  expect(resolveGameIcon("secret_santa")).toBe("secret-santa");
  expect(resolveGameIcon("mind_match")).toBe("mind-match");
  expect(resolveGameIcon("secret_agent")).toBe("secret-agent");
  expect(resolveGameIcon("unknown")).toBe("play");
  expect(resolveAchievementIcon("first_game_completed")).toBe("first-game");
  expect(resolveAchievementIcon("mind_reader")).toBe("mind-reader");
  expect(resolveAchievementIcon("unrecognized-server-id")).toBe("achievement");
});
it("uses bundled colorful Roam illustrations and vector fallbacks", () => {
  render(
    <RoamIllustration name="secret-santa" size={96} label="Mystery gift" />,
  );
  expect(screen.getByRole("img", { name: "Mystery gift" })).toBeTruthy();
  expect(screen.getByTestId("illustration-vector-fallback")).toBeTruthy();
  render(<RoamIllustration name="empty-games" />);
  expect(screen.getAllByTestId("illustration-vector-fallback")).toHaveLength(2);
  expect(iconTokens.colors["secret-santa"]?.ink).toBe("#9A4F47");
  for (const item of Object.values(illustrationManifest)) {
    expect(item.status).toBe("requires-approved-asset");
    expect(item.source).toBeNull();
    expect(item.path).toContain("assets/illustrations/");
  }
});

it("renders every original silhouette as valid SVG at small and large sizes", () => {
  for (const name of Object.keys(
    originalIcons,
  ) as (keyof typeof originalIcons)[]) {
    const { container, unmount } = render(
      <RoamIcon
        name={name}
        size={name === "home" ? 24 : 96}
        variant="filled"
        disabled
        theme="inverse"
        label={name}
      />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.querySelector("path, circle, rect")).toBeTruthy();
    expect(svg.innerHTML).not.toContain("$ink");
    expect(svg.innerHTML).not.toContain("$wash");
    unmount();
  }
});
it("applies the distinct bundled gift palette to the Secret Santa icon", () => {
  const { container } = render(<RoamIcon name="secret-santa" />);
  const svg = container.querySelector("svg")!;
  expect(svg.innerHTML).toContain("#9A4F47");
  expect(svg.innerHTML).toContain("#F6E8E3");
  expect(svg.innerHTML).toContain("#D88E61");
});
it("clamps invalid progress and can render an unlocked badge", () => {
  const { rerender } = render(
    <AchievementBadge
      name="first-game"
      state="progress"
      progress={Number.NaN}
    />,
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "0",
  );
  rerender(
    <AchievementBadge name="first-game" state="progress" progress={2} />,
  );
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "100",
  );
  rerender(
    <AchievementBadge
      name="first-game"
      state="unlocked"
      label="First game earned"
    />,
  );
  expect(screen.getByRole("img", { name: "First game earned" })).toBeTruthy();
});
it("requires license evidence as well as an approved image slot", () => {
  const asset = illustrationManifest["mind-match"];
  const previous = { ...asset };
  try {
    asset.source = { uri: "/approved-test-gift.png" };
    asset.status = "approved";
    const { rerender } = render(<RoamIllustration name="mind-match" />);
    expect(screen.getByTestId("illustration-vector-fallback")).toBeTruthy();
    asset.license = "Test fixture permission record";
    rerender(<RoamIllustration name="mind-match" label="Approved art" />);
    expect(screen.getByTestId("illustration-approved")).toBeTruthy();
  } finally {
    Object.assign(asset, previous);
  }
});
it("supports accessible functional glyph aliases, explicit colours and disabled state", () => {
  render(
    <FunctionalIcon
      name="settings-outline"
      label="Settings"
      color="#086BFF"
      disabled
    />,
  );
  expect(screen.getByRole("img", { name: "Settings" }).style.opacity).toBe(
    "0.45",
  );
});
