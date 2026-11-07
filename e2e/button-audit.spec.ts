import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
const requireFixture = createRequire(`${process.cwd()}/package.json`);
const { createAuditBackend, ids } = requireFixture(
  "./e2e/fixtures/button-audit-backend.cjs",
);
type AuditClick = { role: string; label: string };
const clickLogs = new WeakMap<Page, AuditClick[]>();
test.afterEach(async ({ page }, info) => {
  const clicks = clickLogs.get(page) ?? [];
  await info.attach("button-clicks", {
    body: Buffer.from(JSON.stringify({ test: info.title, clicks }, null, 2)),
    contentType: "application/json",
  });
});
async function fixture(page: Page, options: Record<string, unknown> = {}) {
  const backend = createAuditBackend(options);
  const clicks: AuditClick[] = [];
  clickLogs.set(page, clicks);
  await page.exposeFunction("recordRoamAuditClick", (value: AuditClick) =>
    clicks.push(value),
  );
  await page.addInitScript(() => {
    document.addEventListener(
      "click",
      (event) => {
        const control = (event.target as Element)?.closest?.(
          '[role="button"],button,[role="tab"],[role="switch"]',
        );
        if (control) {
          const label =
            control.getAttribute("aria-label") ??
            control.textContent?.trim() ??
            "";
          void (
            window as unknown as {
              recordRoamAuditClick: (v: {
                role: string;
                label: string;
              }) => Promise<void>;
            }
          ).recordRoamAuditClick({
            role: control.getAttribute("role") ?? "button",
            label,
          });
        }
      },
      true,
    );
  });
  const gates = new Map<string, Promise<void>>();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (options.signedIn !== false)
    await page.addInitScript(
      (value) =>
        localStorage.setItem("sb-127-auth-token", JSON.stringify(value)),
      backend.state.sessionToken,
    );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const req = route.request();
    const headers: Record<string, string> = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    };
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = req.postData() ? req.postDataJSON() : {};
    const key =
      new URL(req.url()).pathname.split("/rpc/")[1] ??
      new URL(req.url()).pathname;
    const gate =
      gates.get(`${key}:${body.p_action ?? req.method()}`) ?? gates.get(key);
    if (gate) await gate;
    const response = backend.handle(req.method(), req.url(), body);
    if (response.location) headers.location = response.location;
    await route.fulfill({
      status: response.status,
      headers,
      ...(response.json === undefined ? { body: "" } : { json: response.json }),
    });
  });
  return {
    ...backend,
    errors,
    hold(key: string) {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      gates.set(key, gate);
      return () => {
        gates.delete(key);
        release();
      };
    },
  };
}
const button = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name, exact: typeof name === "string" });
const heading = (page: Page, name: string) =>
  page.getByRole("heading", { name, exact: true });
test("both sign-in buttons acknowledge attempts and callback recovery works", async ({
  page,
}) => {
  const backend = await fixture(page, { signedIn: false });
  await page.goto("/sign-in");
  await button(page, "Continue with Apple").click();
  await expect(
    page.getByText("Sign-in expired or was declined. Please start again."),
  ).toBeVisible();
  await button(page, "Back to sign in").click();
  await expect(button(page, "Continue with Google")).toBeEnabled();
  await button(page, "Continue with Google").click();
  await expect(heading(page, "Home")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("Home buttons, all five tabs, game details, session edit and group/session links", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/");
  await button(page, "All games").click();
  await expect(heading(page, "What shall we play?")).toBeVisible();
  await button(page, "View Secret Santa").click();
  await expect(button(page, "Create Secret Santa")).toBeVisible();
  await button(page, "Back to Games").click();
  await button(page, "View session: Audit session").click();
  await expect(page.getByText("Status: Draft")).toBeVisible();
  await page
    .getByLabel("Game name", { exact: true })
    .fill("Renamed audit session");
  await button(page, "Save changes").click();
  await expect(heading(page, "Renamed audit session")).toBeVisible();
  await button(page, "View group").click();
  await expect(heading(page, "Audit Friends")).toBeVisible();
  await button(page, "Past audit session").click();
  await expect(page.getByText("Status: Completed")).toBeVisible();
  await button(page, "Back to Games").click();
  for (const name of ["Home", "Groups", "Rewards", "Profile", "Play"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(
      heading(
        page,
        name === "Home"
          ? "Home"
          : name === "Groups"
            ? "Your Groups"
            : name === "Profile"
              ? "Your Profile"
              : name === "Play"
                ? "What shall we play?"
                : name,
      ),
    ).toBeVisible();
  }
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await button(page, "Your profile").click();
  await expect(heading(page, "Your Profile")).toBeVisible();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await button(page, "Notifications (31 unread)").click();
  await expect(heading(page, "Notifications")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("group creation, all icon buttons, group settings, and navigation acknowledge changes", async ({
  page,
}) => {
  const backend = await fixture(page, { initialGroup: false });
  await page.goto("/groups");
  await button(page, "Create Group").click();
  await expect(button(page, "Create Group")).toBeDisabled();
  await button(page, "Back to Groups").click();
  await expect(heading(page, "Bring your people together.")).toBeVisible();
  await button(page, "Create Group").click();
  await page.getByLabel("Group name", { exact: true }).fill("Button club");
  await page
    .getByLabel("Description (optional)", { exact: true })
    .fill("For testing every control");
  for (const label of [
    "people icon",
    "sparkles icon",
    "coffee icon",
    "planet icon",
    "heart icon",
  ]) {
    await button(page, label).click();
    await expect(button(page, label)).toHaveAttribute("aria-pressed", "true");
  }
  await button(page, "No icon").click();
  await expect(button(page, "No icon")).toHaveAttribute("aria-pressed", "true");
  const release = backend.hold("create_group");
  await button(page, "Create Group").click();
  await expect(button(page, "Saving…")).toBeDisabled();
  await expect(page.getByText("Working…")).toBeVisible();
  release();
  await expect(heading(page, "Button club")).toBeVisible();
  await button(page, "Group Settings").click();
  await page
    .getByLabel("Group name", { exact: true })
    .fill("Updated button club");
  await button(page, "Save group settings").click();
  await expect(page.getByText("Group settings saved.")).toBeVisible();
  await button(page, "Back to group").click();
  await expect(heading(page, "Updated button club")).toBeVisible();
  await button(page, "View members").click();
  await expect(heading(page, "Group Members")).toBeVisible();
  await button(page, "Back to group").click();
  await button(page, "Group Settings").click();
  await button(page, "Manage members").click();
  await expect(heading(page, "Group Members")).toBeVisible();
  await button(page, "Back to Groups").click();
  await button(page, "Open group: Updated button club").click();
  await expect(heading(page, "Updated button club")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("invitation preview, validation, alternate-code, join and back buttons", async ({
  page,
}) => {
  const backend = await fixture(page, { initialGroup: false });
  await page.goto("/groups");
  await button(page, "Join a Group").click();
  await expect(button(page, "Find group")).toBeDisabled();
  await page.getByLabel("Invite code", { exact: true }).fill("bad");
  await button(page, "Find group").click();
  await expect(page.getByRole("alert")).toContainText("64-character");
  await page.getByLabel("Invite code", { exact: true }).fill("cd".repeat(32));
  await button(page, "Find group").click();
  await expect(page.getByRole("alert")).toContainText("invalid, expired");
  await page.getByLabel("Invite code", { exact: true }).fill("ab".repeat(32));
  await button(page, "Find group").click();
  await expect(heading(page, "Invitation Preview")).toBeVisible();
  await button(page, "Use another code").click();
  await expect(heading(page, "Join Group")).toBeVisible();
  await button(page, "Back to Groups").click();
  await button(page, "Join a Group").click();
  await page.getByLabel("Invite code", { exact: true }).fill("ab".repeat(32));
  await button(page, "Find group").click();
  await button(page, "Join group").click();
  await expect(heading(page, "Audit Friends")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("remove-member confirmation can be cancelled and confirmed", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto(`/group/${ids.group}/members`);
  await button(page, "Remove Blair").click();
  await expect(page.getByText(/Remove Blair\? Their existing/)).toBeVisible();
  await button(page, "Keep group unchanged").click();
  expect(
    backend.state.calls.some(
      (x: { action: string }) => x.action === "remove_group_member",
    ),
  ).toBe(false);
  await button(page, "Remove Blair").click();
  await button(page, "Confirm").click();
  await expect(button(page, "Remove Blair")).toHaveCount(0);
  expect(backend.state.members.length).toBe(1);
  expect(backend.errors).toEqual([]);
});
test("ownership transfer and member leave have functioning cancel/confirm paths", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto(`/group/${ids.group}/members`);
  await button(page, "Transfer ownership to Blair").click();
  await button(page, "Keep group unchanged").click();
  expect(backend.state.group.owner_id).toBe(ids.alice);
  await button(page, "Transfer ownership to Blair").click();
  await button(page, "Confirm").click();
  await expect(button(page, "Transfer ownership to Blair")).toHaveCount(0);
  await button(page, "Back to group").click();
  await expect(button(page, "Leave group")).toBeVisible();
  await button(page, "Leave group").click();
  await button(page, "Keep group unchanged").click();
  expect(backend.state.hasGroup).toBe(true);
  await button(page, "Leave group").click();
  await button(page, "Confirm").click();
  await expect(heading(page, "Your Groups")).toBeVisible();
  await expect(heading(page, "Bring your people together.")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("group deletion is guarded, cancellable, and can delete only the disposable fixture", async ({
  page,
}) => {
  const backend = await fixture(page, { sessions: false });
  await page.goto(`/group/${ids.group}/settings`);
  await expect(button(page, "Delete group")).toBeDisabled();
  await page
    .getByLabel("Type DELETE to delete this group", { exact: true })
    .fill("delete");
  await expect(button(page, "Delete group")).toBeDisabled();
  await page
    .getByLabel("Type DELETE to delete this group", { exact: true })
    .fill("DELETE");
  await button(page, "Delete group").click();
  await button(page, "Keep group unchanged").click();
  expect(backend.state.hasGroup).toBe(true);
  await button(page, "Delete group").click();
  await button(page, "Confirm").click();
  await expect(heading(page, "Your Groups")).toBeVisible();
  expect(backend.state.hasGroup).toBe(false);
  expect(backend.errors).toEqual([]);
});
test("member-only screens do not expose owner actions and forbidden requests have recovery", async ({
  page,
}) => {
  const backend = await fixture(page, { role: "member" });
  await page.goto(`/group/${ids.group}/settings`);
  await expect(page.getByText("Owner access required")).toBeVisible();
  await expect(button(page, "Save group settings")).toHaveCount(0);
  await button(page, "Back to group").click();
  await button(page, "Invite Friends").click();
  await expect(page.getByText("Ask your group owner")).toBeVisible();
  await button(page, "Back to Groups").click();
  await expect(page.getByText("1 active games")).toBeVisible();
  backend.state.failures.get_group = 1;
  await button(page, "Open group: Audit Friends").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await button(page, "Try again").click();
  await expect(heading(page, "Audit Friends")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("invitation validation, generation, copying, sharing, refresh and revocation", async ({
  page,
  context,
}) => {
  const backend = await fixture(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/group/${ids.group}/invites`);
  await page.getByLabel("Expires in (days, 1–30)", { exact: true }).fill("31");
  await button(page, "Create invite").click();
  await expect(page.getByRole("alert")).toContainText("1–30");
  await page.getByLabel("Expires in (days, 1–30)", { exact: true }).fill("7");
  await page.getByLabel("Use limit (optional)", { exact: true }).fill("0");
  await button(page, "Create invite").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Use limit (optional)", { exact: true }).fill("3");
  await button(page, "Create invite").click();
  await expect(
    page.getByLabel("Your invite code", { exact: true }),
  ).toHaveValue("ab".repeat(32));
  await button(page, "Copy code").click();
  await expect(
    page.getByText("Invite code copied.", { exact: true }),
  ).toBeVisible();
  await button(page, "Share code").click();
  await expect(page.getByRole("alert")).toContainText(/share|supported/i);
  await button(page, "Refresh invites").click();
  await expect(
    page.getByLabel("Your invite code", { exact: true }),
  ).toHaveValue("ab".repeat(32));
  await button(page, `Revoke invitation ${ids.invite.slice(0, 8)}`).click();
  await expect(
    page.getByText("Invitation revoked.", { exact: true }),
  ).toBeVisible();
  await expect(button(page, "Copy code")).toHaveCount(0);
  expect(backend.errors).toEqual([]);
});
test("notification read/unread, paging, and each protected destination acknowledge clicks", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/notifications");
  await expect(page.getByText("31 unread", { exact: true })).toBeVisible();
  await button(page, "Mark as read").first().click();
  await expect(page.getByText("30 unread", { exact: true })).toBeVisible();
  await button(page, "Mark unread").click();
  await expect(page.getByText("31 unread", { exact: true })).toBeVisible();
  await button(page, "Next page").click();
  await expect(page.getByText("Audit notification 31")).toBeVisible();
  await button(page, "Newest notifications").click();
  await expect(
    page.getByText("Audit notification 1", { exact: true }),
  ).toBeVisible();
  await button(page, "Open notification").first().click();
  await expect(heading(page, "Rewards")).toBeVisible();
  await page.goto("/notifications");
  await button(page, "Open notification").nth(1).click();
  await expect(heading(page, "Audit Friends")).toBeVisible();
  await page.goto("/notifications");
  await button(page, "Open notification").nth(2).click();
  await expect(heading(page, "Audit session")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("notification request has immediate busy feedback and retryable failure", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/notifications");
  await expect(button(page, "Mark as read").first()).toBeVisible();
  const release = backend.hold("notification_account:read");
  await button(page, "Mark as read").first().click();
  await expect(button(page, "Mark as read").first()).toBeDisabled();
  await expect(page.getByText("Updating notification…")).toBeVisible();
  release();
  await expect(page.getByText("30 unread", { exact: true })).toBeVisible();
  backend.state.failures.notification_account = 1;
  await button(page, "Mark unread").click();
  await expect(page.getByRole("alert")).toContainText("Unable to update");
  await button(page, "Mark unread").click();
  await expect(page.getByText("31 unread", { exact: true })).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("device-settings browser button gives feedback rather than throwing", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/notification-settings");
  await button(page, "Device settings").click();
  await expect(
    page.getByText(
      /Open.*iOS or Android|system settings to manage notification/i,
    ),
  ).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("saving browser preferences must not silently disable push enabled on another device", async ({
  page,
}) => {
  const backend = await fixture(page, { pushEnabled: true });
  await page.goto("/notification-settings");
  await expect(
    page.getByRole("switch", {
      name: "Push notifications enabled",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("switch", { name: "Activity reminders", exact: true })
    .click();
  await button(page, "Save settings").click();
  await expect(
    page.getByText("Notifications saved.", { exact: true }),
  ).toBeVisible();
  expect(backend.state.prefs.push_enabled).toBe(true);
  expect(backend.errors).toEqual([]);
});
test("all preference toggles, time fields, validation and save acknowledgement", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/notifications");
  await button(page, "Notifications").click();
  for (const name of [
    "Group updates",
    "Game updates",
    "My turn notifications",
    "Secret messages",
    "Activity reminders",
    "Rewards and achievements",
    "Quiet hours enabled",
  ]) {
    const control = page.getByRole("switch", { name, exact: true });
    const before = await control.isChecked();
    await control.click();
    if (before) await expect(control).not.toBeChecked();
    else await expect(control).toBeChecked();
  }
  await page.getByLabel("Reminder time (HH:MM)", { exact: true }).fill("19:30");
  await page.getByLabel("Quiet from (HH:MM)", { exact: true }).fill("23:00");
  await page.getByLabel("Quiet until (HH:MM)", { exact: true }).fill("07:00");
  await page
    .getByLabel("Timezone (e.g. Europe/Helsinki)", { exact: true })
    .fill("invalid/zone");
  await button(page, "Save settings").click();
  await expect(page.getByText(/Unable to save settings/)).toBeVisible();
  await page
    .getByLabel("Timezone (e.g. Europe/Helsinki)", { exact: true })
    .fill("UTC");
  await button(page, "Save settings").click();
  await expect(
    page.getByText("Notifications saved.", { exact: true }),
  ).toBeVisible();
  expect(backend.state.prefs.preferred_reminder_time).toBe("19:30");
  await button(page, "Back to notifications").click();
  await expect(heading(page, "Notifications")).toBeVisible();
  await button(page, "Back to Home").click();
  await expect(heading(page, "Home")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("rewards refresh, load-more/retry, and every collectible open/back button", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/rewards");
  await expect(heading(page, "Level 4")).toBeVisible();
  await button(page, "Refresh rewards").click();
  await expect(heading(page, "Level 4")).toBeVisible();
  backend.state.failures.reward_account = 1;
  await button(page, "Load more rewards").click();
  await expect(page.getByRole("alert")).toContainText("Unable to load more");
  await button(page, "Try again").click();
  await expect(button(page, "Load more rewards")).toHaveCount(0);
  await expect(page.getByText("+20 XP", { exact: true })).toHaveCount(31);
  for (const name of [
    "First Steps",
    "Mind Reader",
    "Gift Detective",
    "Mystery Solver",
    "Dedicated Explorer",
  ]) {
    await button(
      page,
      `View ${name} card, ${name === "First Steps" ? "unlocked" : "locked"}`,
    ).click();
    await expect(button(page, "Back to rewards")).toBeVisible();
    await expect(
      page
        .getByText(name === "First Steps" ? /^Earned / : /^Locked ·/)
        .filter({ visible: true }),
    ).toBeVisible();
    await button(page, "Back to rewards").click();
    await expect(heading(page, "Rewards")).toBeVisible();
  }
  await expect(button(page, "Refresh rewards")).toBeVisible();
  backend.state.failures.reward_account = 1;
  await button(page, "Refresh rewards").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await button(page, "Try again").click();
  await expect(heading(page, "Level 4")).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("profile save validates, disables while busy, retries failures and updates Home", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/profile");
  await button(page, "Edit Profile").click();
  await page.getByLabel("Display name", { exact: true }).fill("");
  await button(page, "Save changes").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Display name", { exact: true }).fill("Button Auditor");
  const release = backend.hold("/rest/v1/profiles:PATCH");
  await button(page, "Save changes").click();
  await expect(button(page, "Saving…")).toBeDisabled();
  await expect(
    page.getByLabel("Display name", { exact: true }),
  ).not.toBeEditable();
  release();
  await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  await button(page, "Back to Profile").click();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await expect(button(page, "Your profile")).toHaveText("BA");
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await button(page, "Edit Profile").click();
  await expect(button(page, "Save changes")).toBeDisabled();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Button Auditor Updated");
  backend.state.failures["/rest/v1/profiles"] = 1;
  await button(page, "Save changes").click();
  await expect(page.getByRole("alert")).toContainText("Unable to save");
  await button(page, "Save changes").click();
  await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  expect(backend.errors).toEqual([]);
});
test("sign-out clears this device even when remote revocation fails", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/profile");
  backend.state.failures["/auth/v1/logout"] = 1;
  await button(page, "Sign out").click();
  await button(page, "I already have an account").click();
  await expect(button(page, "Continue with Google")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("sb-127-auth-token")),
  ).toBeNull();
  expect(
    backend.state.calls.some(
      (call: { action: string }) => call.action === "/auth/v1/logout",
    ),
  ).toBe(true);
  expect(backend.errors).toEqual([]);
});
test("account deletion guard, cancel, and disposable confirmation all acknowledge correctly", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/profile");
  await button(page, "Privacy & account").click();
  await button(page, "Delete account").click();
  await expect(button(page, "Permanently delete account")).toBeDisabled();
  await button(page, "Keep my account").click();
  expect(backend.state.deleted).toBeUndefined();
  await button(page, "Delete account").click();
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("delete");
  await expect(button(page, "Permanently delete account")).toBeDisabled();
  await page
    .getByLabel("Type DELETE to confirm", { exact: true })
    .fill("DELETE");
  await button(page, "Permanently delete account").click();
  await expect(button(page, "Continue with Google")).toBeVisible();
  expect(backend.state.deleted).toBe(true);
  expect(backend.errors).toEqual([]);
});
