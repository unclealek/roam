import { test, expect, type Page } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
async function fixture(page: Page) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "notifications@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  await page.addInitScript(
    (value) => localStorage.setItem("sb-127-auth-token", JSON.stringify(value)),
    {
      access_token: [
        Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
          "base64url",
        ),
        Buffer.from(
          JSON.stringify({
            sub: id,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ).toString("base64url"),
        "fixture",
      ].join("."),
      refresh_token: "fixture",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    },
  );
  const now = new Date().toISOString();
  const notification = {
    id,
    user_id: id,
    category: "your_turn",
    template_key: "activity_unlocked",
    title: "New activity",
    body: "A new challenge is waiting for you.",
    route: "/notifications",
    related_session_id: null,
    read_at: null as string | null,
    created_at: now,
    event_key: "unlock:fixture",
  };
  let preferences = {
    user_id: id,
    push_enabled: false,
    group_updates_enabled: true,
    game_updates_enabled: true,
    your_turn_enabled: true,
    secret_messages_enabled: true,
    reminders_enabled: false,
    rewards_enabled: false,
    preferred_reminder_time: "18:00",
    quiet_hours_enabled: true,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    timezone: "UTC",
    updated_at: now,
  };
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const req = route.request();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let data: unknown = { user };
    if (req.url().includes("/profiles"))
      data = { id, display_name: "Alex", created_at: now, updated_at: now };
    if (req.url().includes("/notification_account")) {
      const { p_action, p_data } = req.postDataJSON();
      if (p_action === "read") {
        notification.read_at = p_data.read === false ? null : now;
        data = true;
      } else if (p_action === "list")
        data = {
          unread_count: notification.read_at ? 0 : 1,
          items: [notification],
        };
      else {
        if (p_action === "save_preferences")
          preferences = { ...preferences, ...p_data };
        data = preferences;
      }
    }
    await route.fulfill({ json: data, headers });
  });
}
test("home unread count, owned notification read state and settings work on mobile web", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Notifications (1 unread)", exact: true })
    .click();
  await expect(page.getByText("1 unread", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/scope0754-notification-center.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(page.getByText("0 unread", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark unread", exact: true }).click();
  await expect(page.getByText("1 unread", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/scope0754-notification-preferences.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByLabel("Timezone (e.g. Europe/Helsinki)", { exact: true })
    .fill("Europe/Helsinki");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByText("Notifications saved.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/scope04-notification-settings.png",
    fullPage: true,
  });
});
test("notification deep links require authentication", async ({ page }) => {
  await page.goto("/notifications");
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeVisible();
  await page.goto("/notification-settings");
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeVisible();
});
