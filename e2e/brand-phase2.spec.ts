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
}

for (const appearance of ["light", "dark"] as const) {
  for (const width of [320, 430]) {
    test(`Phase 2 ${appearance} ${width}: groups and player identity`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 932 });
      await page.emulateMedia({
        colorScheme: appearance,
        reducedMotion: "reduce",
      });
      await fixture(page);
      await page.goto("/groups");
      await expect(
        page.getByRole("heading", { name: "Your Groups", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("1 active games")).toBeVisible();
      await page.screenshot({
        path: `docs/design/scope-07-5-phase2/screenshots/groups-${appearance}-${width}.png`,
      });
      await page
        .getByRole("button", { name: "Open group: Audit Friends" })
        .click();
      await expect(
        page.getByRole("button", { name: "Play a Game" }),
      ).toBeVisible();
      await page.screenshot({
        path: `docs/design/scope-07-5-phase2/screenshots/detail-${appearance}-${width}.png`,
      });
      await page.getByRole("button", { name: "Play a Game" }).click();
      await expect(page).toHaveURL(new RegExp(`games\\?groupId=${ids.group}`));
      await page.getByRole("button", { name: "View Secret Santa" }).click();
      await page.getByRole("button", { name: "Create Secret Santa" }).click();
      await expect(page).toHaveURL(new RegExp(`create\\?groupId=${ids.group}`));
      await page.goto("/profile");
      await expect(page.getByText("620 total XP")).toBeVisible();
      await expect(page.getByText("230 XP to level 5")).toBeVisible();
      await page.screenshot({
        path: `docs/design/scope-07-5-phase2/screenshots/profile-${appearance}-${width}.png`,
      });
      await page.getByRole("button", { name: "View rewards" }).click();
      await expect(
        page.getByRole("heading", { name: "Rewards", exact: true }),
      ).toBeVisible();
      await page.goto("/profile");
      await page
        .getByRole("button", { name: "Edit Profile", exact: true })
        .click();
      await page
        .getByLabel("Display name", { exact: true })
        .fill("Alex Player");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Profile saved.")).toBeVisible();
      await page.screenshot({
        path: `docs/design/scope-07-5-phase2/screenshots/edit-${appearance}-${width}.png`,
      });
      await page.getByRole("button", { name: "Back to Profile" }).click();
      await expect(
        page.getByRole("heading", { name: "Alex Player", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Notifications", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Notifications",
          exact: true,
        }),
      ).toBeVisible();
    });
  }
}
