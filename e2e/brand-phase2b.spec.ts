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
    const req = route.request();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    };
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const r = backend.handle(
      req.method(),
      req.url(),
      req.postData() ? req.postDataJSON() : {},
    );
    return route.fulfill({
      status: r.status,
      headers,
      ...(r.json === undefined ? { body: "" } : { json: r.json }),
    });
  });
  return backend;
}

for (const appearance of ["light", "dark"] as const) {
  for (const width of [320, 430]) {
    test(`Phase 2B ${appearance} ${width}: surfaces, dialogs, sheets and feedback`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 932 });
      await page.emulateMedia({
        colorScheme: appearance,
        reducedMotion: "reduce",
      });
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      const backend = await fixture(page);
      const capture = async (name: string) =>
        page.screenshot({
          path: `docs/design/scope-07-5-phase2b/screenshots/${name}-${appearance}-${width}.png`,
        });
      for (const [route, name, target] of [
        ["/", "home", "Your profile"],
        ["/groups", "groups", "Join with Code"],
        ["/games", "games", "View session: Audit session"],
        ["/profile", "profile", "Sign out"],
      ]) {
        await page.goto(route);
        await expect(
          page.getByRole("button", { name: target, exact: true }),
        ).toBeVisible();
        await capture(name);
        const last = page.getByRole("button", { name: target, exact: true });
        await last.scrollIntoViewIfNeeded();
        const control = await last.boundingBox();
        const tabs = await page.getByRole("tablist").boundingBox();
        expect(control).not.toBeNull();
        expect(tabs).not.toBeNull();
        expect(control!.y + control!.height).toBeLessThanOrEqual(tabs!.y);
        if (name === "profile") await capture("profile-settings");
      }
      await page.goto("/edit-profile");
      await expect(
        page.getByRole("button", { name: "Save changes", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Back to Profile", exact: true }),
      ).toHaveCount(1);
      await capture("edit-profile");
      let releaseSave!: () => void;
      const saving = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      await page.route("**/rest/v1/profiles?**", async (route) => {
        if (route.request().method() === "PATCH") await saving;
        await route.fallback();
      });
      await page
        .getByLabel("Display name", { exact: true })
        .fill("Alex Polished");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Saving…", exact: true }),
      ).toBeDisabled();
      await capture("loading-button");
      releaseSave();
      await expect(page.getByRole("status")).toHaveText("Profile saved.");
      await page
        .getByRole("button", { name: "Dismiss feedback", exact: true })
        .click();
      backend.state.hasSessions = false;
      await page.goto("/");
      await expect(
        page.getByRole("heading", {
          name: "No games in progress",
          exact: true,
        }),
      ).toBeVisible();
      await capture("empty-state");
      backend.state.hasSessions = true;
      await page.goto("/rewards");
      await expect(
        page.getByRole("heading", { name: "Level 4", exact: true }),
      ).toBeVisible();
      await capture("rewards");
      const collectible = page
        .getByRole("button", { name: /^View .* card, (unlocked|locked)$/ })
        .last();
      await collectible.scrollIntoViewIfNeeded();
      const cardBounds = await collectible.boundingBox();
      const barBounds = await page.getByRole("tablist").boundingBox();
      expect(cardBounds!.y + cardBounds!.height).toBeLessThanOrEqual(
        barBounds!.y,
      );
      await capture("collection");
      await page.goto("/notifications");
      await expect(
        page.getByText(/unread$/, { exact: false }).first(),
      ).toBeVisible();
      await capture("notifications");
      await page.goto("/profile");
      await page
        .getByRole("button", { name: "Profile actions", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Profile actions", exact: true }),
      ).toBeVisible();
      await capture("profile-sheet");
      await page
        .getByRole("button", { name: "Close sheet", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Profile actions", exact: true }),
      ).toHaveCount(0);
      await page.goto("/games");
      await page
        .getByRole("button", { name: "Choose group", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Choose a group", exact: true }),
      ).toBeVisible();
      await capture("group-sheet");
      await page
        .getByRole("button", { name: "Play with Audit Friends", exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`groupId=${ids.group}`));
      await page.goto(`/group/${ids.group}/members`);
      await page
        .getByRole("button", { name: "Remove Blair", exact: true })
        .click();
      await expect(
        page.getByRole("alertdialog", {
          name: "Confirm group change",
          exact: true,
        }),
      ).toBeVisible();
      await capture("confirmation");
      await page
        .getByRole("button", { name: "Keep group unchanged", exact: true })
        .click();
      expect(backend.state.members.length).toBe(2);
      await page.goto(`/group/${ids.group}/invites`);
      await page
        .getByRole("button", { name: "Create invite", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Copy code", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText("Invite code copied.");
      await capture("copy-feedback");
      await page
        .getByRole("button", { name: "Dismiss feedback", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveCount(0);
      await page.goto("/notification-settings");
      await page
        .getByRole("button", { name: "Save settings", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText("Notifications saved.");
      await capture("settings-feedback");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    });
  }
}
