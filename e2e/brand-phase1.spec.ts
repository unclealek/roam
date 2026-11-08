import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
const requireFixture = createRequire(`${process.cwd()}/package.json`);
const { createAuditBackend } = requireFixture(
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
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 430, height: 932 },
  ]) {
    test(`Phase 1 ${appearance} ${viewport.width}: Home, catalog, navigation`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({
        colorScheme: appearance,
        reducedMotion: "reduce",
      });
      await fixture(page);
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Hey, Alex!", exact: true }),
      ).toBeVisible();
      const notificationButton = page.getByRole("button", {
        name: "Notifications (31 unread)",
      });
      const profileButton = page.getByRole("button", { name: "Your profile" });
      await expect(notificationButton).toBeVisible();
      await expect(profileButton).toBeVisible();
      await expect(
        notificationButton.getByText("31", { exact: true }),
      ).toBeVisible();
      await expect(profileButton.getByText("A", { exact: true })).toBeVisible();
      for (const button of [notificationButton, profileButton]) {
        await expect(button).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      }
      await expect(page.getByText("Roam", { exact: true })).toHaveCount(0);
      const sessionCard = page.getByRole("button", {
        name: "View session: Audit session",
        exact: true,
      });
      await expect(sessionCard).toBeVisible();
      const adventureCard = page.getByTestId("home-adventure-card");
      await expect(
        adventureCard.getByRole("heading", {
          name: "Your next adventure starts here.",
        }),
      ).toBeVisible();
      await expect(
        adventureCard.locator('img[src*="roam-mascot-run"]'),
      ).toHaveJSProperty("complete", true);
      const cloudImage = 'img[src*="home-clouds"]';
      const sessionArtwork = sessionCard.locator(cloudImage);
      await expect(sessionArtwork).toHaveCount(1);
      await expect(adventureCard.locator(cloudImage)).toHaveAttribute(
        "src",
        (await sessionArtwork.getAttribute("src"))!,
      );
      await expect(
        page.getByRole("button", { name: "Open group: Audit Friends" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Your Groups", exact: true }),
      ).toBeVisible();
      const secretSanta = page.getByRole("button", {
        name: "View Secret Santa",
      });
      await expect(secretSanta).toBeVisible();
      const artworkHeight = await secretSanta
        .locator(cloudImage)
        .evaluate((image) => {
          const card = image.closest('[role="button"]')!;
          const artwork = image.parentElement!;
          return {
            artwork: artwork.getBoundingClientRect().height,
            card: card.clientHeight,
          };
        });
      expect(Math.abs(artworkHeight.artwork - artworkHeight.card)).toBeLessThan(
        1,
      );
      await expect(
        page.getByRole("button", { name: "Mind Match — Coming soon" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Secret Agent — Coming soon" }),
      ).toBeVisible();
      await expect(
        page.getByRole("progressbar", { name: "Players joined" }),
      ).toBeVisible();
      await expect(page.getByText("B", { exact: true })).toBeVisible();
      await expect(page.getByTestId("roam-background-home")).toBeAttached();
      expect(
        await page
          .getByRole("tab")
          .evaluateAll((tabs) =>
            tabs.map((tab) => tab.getAttribute("aria-label")),
          ),
      ).toEqual(["Home", "Groups", "Play", "Rewards", "Profile"]);
      const color = await page
        .getByRole("heading", { name: "Hey, Alex!", exact: true })
        .evaluate((el) => getComputedStyle(el).color);
      expect(color).toBe(
        appearance === "dark" ? "rgb(244, 241, 234)" : "rgb(28, 40, 56)",
      );
      await page.screenshot({
        path: `test-results/phase1-home-${appearance}-${viewport.width}.png`,
        fullPage: true,
      });
      await page.getByRole("tab", { name: "Play", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "What shall we play?", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "View Secret Santa" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /Mind Match|Secret Agent/ }),
      ).toHaveCount(0);
      await page.screenshot({
        path: `test-results/phase1-catalog-${appearance}-${viewport.width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.getByRole("button", { name: "View Secret Santa" }).click();
      await expect(
        page.getByRole("button", { name: "Create Secret Santa", exact: true }),
      ).toBeVisible();
    });
  }
  test(`Phase 1 ${appearance}: welcome and actual provider entry`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: appearance });
    await page.goto("/welcome");
    await expect(
      page.getByRole("heading", { name: "Roam", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("roam-mascot-idle")).toHaveCount(1);
    await expect(page.locator('img[src*="roam-mascot-wave"]')).toHaveJSProperty(
      "complete",
      true,
    );
    await page.screenshot({
      path: `test-results/phase1-welcome-${appearance}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Tap anywhere to begin" }).click();
    await page
      .getByRole("button", { name: "Get started", exact: true })
      .click();
    await expect(
      page.locator('img[src*="roam-mascot-explorer"]'),
    ).toHaveJSProperty("complete", true);
    await page.screenshot({
      path: `test-results/phase1-onboarding-${appearance}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Previous screen" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator('img[src*="roam-mascot-wave"]')).toHaveJSProperty(
      "complete",
      true,
    );
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Apple" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/phase1-login-${appearance}.png`,
      fullPage: true,
    });
  });
}
