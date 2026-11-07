import { expect, it } from "vitest";
import {
  foregroundPresentationSuppressed,
  setForegroundRouteSuppressed,
  suspendForegroundPresentation,
} from "../src/platform/notifications/presentation";
import {
  isCriticalFeedbackRoute,
  suppressForegroundBanner,
} from "../src/presentation/brand/feedback-policy";
it("keeps nested confirmation overlays protected until all are dismissed", () => {
  setForegroundRouteSuppressed(false);
  const first = suspendForegroundPresentation(),
    second = suspendForegroundPresentation();
  expect(foregroundPresentationSuppressed()).toBe(true);
  first();
  first();
  expect(foregroundPresentationSuppressed()).toBe(true);
  second();
  expect(foregroundPresentationSuppressed()).toBe(false);
});
it("suppresses interrupting banners on forms/reveals and avoids duplicate rewards/center presentation", () => {
  for (const path of [
    "/edit-profile",
    "/group/create",
    "/group/join",
    "/privacy",
    "/game/secret_santa/recipient/id",
    "/notification-settings",
  ])
    expect(isCriticalFeedbackRoute(path)).toBe(true);
  expect(suppressForegroundBanner("/notifications")).toBe(true);
  expect(suppressForegroundBanner("/rewards")).toBe(true);
  expect(suppressForegroundBanner("/")).toBe(false);
});
it("gates foreground notices using the stored category preference", async () => {
  const { foregroundNoticeAllowed } =
    await import("../src/platform/notifications/presentation");
  expect(foregroundNoticeAllowed("rewards", { rewards_enabled: false })).toBe(
    false,
  );
  expect(foregroundNoticeAllowed("rewards", { rewards_enabled: true })).toBe(
    true,
  );
  expect(foregroundNoticeAllowed("unknown", { rewards_enabled: true })).toBe(
    false,
  );
});
