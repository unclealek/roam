import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
const requireFixture = createRequire(`${process.cwd()}/package.json`);
const { createAuditBackend } = requireFixture(
  "./e2e/fixtures/button-audit-backend.cjs",
);
test("original tab artwork preserves selection, navigation and accessible labels", async ({
  page,
}) => {
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
    const result = backend.handle(
      req.method(),
      req.url(),
      req.postData() ? req.postDataJSON() : {},
    );
    return route.fulfill({
      status: result.status,
      headers,
      ...(result.json === undefined ? { body: "" } : { json: result.json }),
    });
  });
  await page.goto("/");
  for (const label of ["Home", "Groups", "Play", "Rewards", "Profile"]) {
    const tab = page.getByRole("tab", { name: label, exact: true });
    // React Navigation keeps both states mounted for its built-in transition.
    await expect(tab.locator("svg")).toHaveCount(2);
    await expect(tab.locator("svg").first()).toHaveAttribute("width", "24");
  }
  await expect(
    page.getByRole("tab", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.screenshot({
    path: "docs/design/icons/screenshots/home-web.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Groups", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Groups", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Groups", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Play", exact: true }).click();
  await expect(
    page
      .getByRole("button", { name: "View Secret Santa", exact: true })
      .locator("svg"),
  ).not.toHaveCount(0);
  await page.getByRole("tab", { name: "Rewards", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Rewards", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/design/icons/screenshots/rewards-web.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your Profile", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
