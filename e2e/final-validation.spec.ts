import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
const requireFixture = createRequire(`${process.cwd()}/package.json`);
const { createAuditBackend, ids } = requireFixture(
  "./e2e/fixtures/button-audit-backend.cjs",
);
async function fixture(page: Page) {
  const backend = createAuditBackend();
  await page.addInitScript(
    (value) => localStorage.setItem("sb-127-auth-token", JSON.stringify(value)),
    backend.state.sessionToken,
  );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const result = backend.handle(
      request.method(),
      request.url(),
      request.postData() ? request.postDataJSON() : {},
    );
    await route.fulfill({
      status: result.status,
      headers,
      ...(result.json === undefined ? { body: "" } : { json: result.json }),
    });
  });
}
for (const appearance of ["light", "dark"] as const) {
  test(`final screen inventory ${appearance} small layout`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.emulateMedia({
      colorScheme: appearance,
      reducedMotion: "reduce",
    });
    await fixture(page);
    const routes = [
      ["home", "/", "Home"],
      ["groups", "/groups", "Your Groups"],
      ["games", "/games", "What shall we play?"],
      ["rewards", "/rewards", "Rewards"],
      ["profile", "/profile", "Your Profile"],
      ["edit-profile", "/edit-profile", "Edit Profile"],
      ["create-group", "/group/create", "Create Group"],
      ["join-group", "/group/join", "Join Group"],
      ["group-details", `/group/${ids.group}`, "Audit Friends"],
      ["group-members", `/group/${ids.group}/members`, "Group Members"],
      ["group-settings", `/group/${ids.group}/settings`, "Group Settings"],
      ["invitations", `/group/${ids.group}/invites`, "Invite Friends"],
      ["notifications", "/notifications", "Notifications"],
      ["preferences", "/notification-settings", "Notifications"],
      ["account", "/privacy", "Privacy & account"],
      ["collectible", "/collectible/first_steps", "First Steps"],
      ["achievement-missing", "/achievement/missing", "Achievement not found"],
    ];
    for (const [name, path, heading] of routes) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }).first(),
      ).toBeVisible();
      await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        name,
      ).toBe(true);
      await page.screenshot({
        path: `docs/artifacts/scope-07.5.5/${name}-${appearance}-320.png`,
        fullPage: true,
        animations: "disabled",
      });
      if (["/", "/groups", "/games", "/rewards", "/profile"].includes(path)) {
        const lastAction = page.getByRole("button").last();
        await lastAction.scrollIntoViewIfNeeded();
        const actionBounds = await lastAction.boundingBox();
        const tabBounds = await page.getByRole("tab").first().boundingBox();
        expect(actionBounds).not.toBeNull();
        expect(tabBounds).not.toBeNull();
        expect(actionBounds!.y + actionBounds!.height).toBeLessThanOrEqual(
          tabBounds!.y + 1,
        );
        await page.screenshot({
          path: `docs/artifacts/scope-07.5.5/${name}-${appearance}-bottom.png`,
          animations: "disabled",
        });
      }
    }
  });
  test(`onboarding and sign-in ${appearance}`, async ({ page }) => {
    await page.emulateMedia({
      colorScheme: appearance,
      reducedMotion: "reduce",
    });
    await page.goto("/welcome");
    await page.getByRole("button", { name: "Tap anywhere to begin" }).click();
    await page
      .getByRole("button", { name: "Get started", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Make a group" }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/artifacts/scope-07.5.5/onboarding-${appearance}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/artifacts/scope-07.5.5/sign-in-${appearance}.png`,
      fullPage: true,
    });
  });
}
