import { test, expect } from "@playwright/test";
test("signed-out deep links require sign-in", async ({ page }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "I already have an account" }).click();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(page.getByText("Your profile", { exact: true })).toHaveCount(0);
});
test("restored session navigates all tabs, edits profile, and deletes account", async ({
  page,
}) => {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "fixture@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const profile = {
    id: user.id,
    display_name: "Alex",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const fakeSession = {
    access_token: [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
          role: "authenticated",
        }),
      ).toString("base64url"),
      Buffer.from("test-only-invalid-signature").toString("base64url"),
    ].join("."),
    refresh_token: "test-fixture-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  await page.addInitScript(
    (value) => localStorage.setItem("sb-127-auth-token", JSON.stringify(value)),
    fakeSession,
  );
  let deleted = false;
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (request.url().includes("/rpc/delete_own_account")) {
      deleted = true;
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (request.url().includes("/game_types")) {
      await route.fulfill({
        json: [
          {
            id: "secret_santa",
            name: "Secret Santa",
            description:
              "Exchange secret gifts, discover clues and play mystery challenges with friends.",
            category: "Social / Mystery",
            icon_ref: "gift",
            min_players: 2,
            max_players: null,
            availability_status: "coming_soon",
          },
        ],
        headers: cors,
      });
      return;
    }
    if (
      request.url().includes("/list_my_game_sessions") ||
      request.url().includes("/list_my_groups")
    ) {
      await route.fulfill({ json: [], headers: cors });
      return;
    }
    if (request.url().includes("/rpc/reward_account")) {
      await route.fulfill({
        json: {
          progress: {
            level: 1,
            total_xp: 0,
            level_xp: 0,
            next_level_xp: 100,
            xp_into_level: 0,
            xp_to_next_level: 100,
            progress: 0,
          },
          game_progress: [],
          collectibles: [],
          achievements: [],
          history: [],
        },
        headers: cors,
      });
      return;
    }
    if (request.method() === "PATCH")
      Object.assign(profile, request.postDataJSON());
    await route.fulfill({
      json: request.url().includes("/profiles") ? profile : { user },
      headers: cors,
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Home", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/home-mobile.png" });
  for (const title of ["Play", "Groups", "Rewards"]) {
    await page.getByRole("tab", { name: title, exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name:
          title === "Groups"
            ? "Your Groups"
            : title === "Play"
              ? "What shall we play?"
              : title,
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
  await page.getByLabel("Display name").fill("Alex Updated");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page.getByRole("button", { name: "Back to Profile" }).click();
  await page.getByRole("button", { name: "Privacy & account" }).click();
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Permanently delete account" }),
  ).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeVisible();
  expect(deleted).toBe(true);
});
