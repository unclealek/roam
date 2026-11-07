import { expect, test } from "@playwright/test";

test("greeting, all onboarding pages, and account entry paths", async ({
  page,
}) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: "Roam" })).toBeVisible();
  await page.getByRole("button", { name: "Tap anywhere to begin" }).click();
  await page.screenshot({
    path: "docs/design/figma-make/screenshots/welcome.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make a group" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pick a game" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "See what you’ve earned" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Roam" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "I already have an account" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New to Roam? Get started" }),
  ).toHaveCount(0);
});

test("existing players can bypass onboarding and small screens scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Tap anywhere to begin" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Roam" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
