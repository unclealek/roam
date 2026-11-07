import { expect, it } from "vitest";
import {
  notificationRoute,
  notificationDestination,
} from "../src/platform/notifications/routes";
it("permits only known, parameter-free resource destinations", () => {
  for (const path of ["/collectible/first_steps", "/achievement/first_game"])
    expect(notificationRoute(path)).toBe(path);
  for (const path of [
    "/collectible/../profile",
    "/achievement/a?xp=999",
    "https://evil.test",
    "/collectible/%2fadmin",
    "/rewards?award=20",
  ])
    expect(notificationRoute(path)).toBeNull();
});
it("labels the stored destination without inferring secret assignment data", () => {
  expect(notificationDestination("/collectible/first_steps")).toBe(
    "Collectible details",
  );
  expect(notificationDestination("/achievement/first_game")).toBe(
    "Achievement details",
  );
  expect(
    notificationDestination("/session/11111111-1111-4111-8111-111111111111"),
  ).toBe("Game session");
  expect(notificationDestination(null)).toBe("Notifications");
});
it("resolves existing reward event references from owned records without changing backend payloads", async () => {
  const { notificationTarget } =
    await import("../src/platform/notifications/routes");
  expect(
    notificationTarget({
      route: "/rewards",
      template_key: "reward_unlocked",
      event_key: "card:first_steps",
    }),
  ).toBe("/collectible/first_steps");
  expect(
    notificationTarget({
      route: "/rewards",
      template_key: "achievement_earned",
      event_key: "achievement:first_game:global",
    }),
  ).toBe("/achievement/first_game");
  expect(
    notificationTarget({
      route: "/rewards",
      template_key: "reward_unlocked",
      event_key: "card:../profile",
    }),
  ).toBe("/rewards");
  expect(
    notificationTarget({
      route: "https://evil.test",
      template_key: "reward_unlocked",
      event_key: "card:first_steps",
    }),
  ).toBeNull();
});
