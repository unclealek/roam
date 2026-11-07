import { test, expect, type Page } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
const code = "ab".repeat(32);
async function fixture(page: Page, withMember = false) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "groups@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const profile = {
    id,
    display_name: "Alex",
    created_at: user.created_at,
    updated_at: user.created_at,
  };
  const group = {
    id,
    name: "Office Friends",
    description: "For every game",
    icon_key: "coffee",
    owner_id: id,
    vice_owner_id: null as string | null,
    member_count: 1,
    created_at: user.created_at,
    updated_at: user.created_at,
  };
  let exists = false;
  const invites: Record<string, unknown>[] = [];
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
        Buffer.from("test-only-invalid-signature").toString("base64url"),
      ].join("."),
      refresh_token: "fixture",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    },
  );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const req = route.request();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS,PATCH",
    };
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const rpc = req.url().split("/rpc/")[1];
    let data: unknown;
    switch (rpc) {
      case "secret_santa_lobby":
        data = [];
        break;
      case "list_my_groups":
        data = exists ? [group] : [];
        break;
      case "create_group": {
        const input = req.postDataJSON();
        Object.assign(group, {
          name: input.p_name,
          description: input.p_description,
          icon_key: input.p_icon_key,
        });
        exists = true;
        data = group;
        break;
      }
      case "get_group":
        data = {
          ...group,
          members: [
            {
              user_id: id,
              display_name: "Alex",
              role: "owner",
              joined_at: user.created_at,
            },
            ...(withMember
              ? [
                  {
                    user_id: "22222222-2222-4222-8222-222222222222",
                    display_name: "Bob",
                    role: "member",
                    joined_at: user.created_at,
                  },
                ]
              : []),
          ],
          sessions: [],
          invites,
        };
        break;
      case "set_group_vice_owner":
        group.vice_owner_id = req.postDataJSON().p_user_id;
        group.updated_at = new Date().toISOString();
        data = null;
        break;
      case "create_group_invite": {
        const i = {
          id: "22222222-2222-4222-8222-222222222222",
          group_id: id,
          expires_at: "2026-11-01T00:00:00Z",
          revoked_at: null,
          max_uses: null,
          use_count: 0,
          created_at: user.created_at,
        };
        invites.push(i);
        data = { ...i, code };
        break;
      }
      case "revoke_group_invite":
        invites[0].revoked_at = user.created_at;
        data = null;
        break;
      case "preview_group_invite":
        data =
          req.postDataJSON().p_code === code
            ? {
                id,
                name: group.name,
                description: group.description,
                icon_key: group.icon_key,
                member_count: 1,
              }
            : { error: "unavailable" };
        break;
      case "redeem_group_invite":
        data = group;
        break;
      default:
        data = req.url().includes("/profiles") ? profile : { user };
    }
    await route.fulfill({ json: data, headers });
  });
}
test("create a persistent group, generate and revoke an invitation", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/groups");
  await expect(page.getByText("Bring your people together.")).toBeVisible();
  await page.getByRole("button", { name: "Create Group", exact: true }).click();
  await page.getByLabel("Group name").fill("Office Friends");
  await page.getByLabel("Description (optional)").fill("For every game");
  await page.getByRole("button", { name: "coffee icon" }).click();
  await page.getByRole("button", { name: "Create Group", exact: true }).click();
  await expect(page.getByText("Owner: Alex")).toBeVisible();
  await expect(page.getByText("No active games")).toBeVisible();
  await page.screenshot({
    path: "test-results/group-details-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Invite Friends" }).click();
  await page.getByRole("button", { name: "Create invite" }).click();
  await expect(page.getByLabel("Your invite code")).toHaveValue(code);
  await expect(page.getByRole("button", { name: "Share code" })).toBeVisible();
  await page.screenshot({
    path: "test-results/group-invitation-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Revoke invitation/ }).click();
  await expect(page.getByText("Invitation revoked.")).toBeVisible();
  await expect(page.getByLabel("Your invite code")).toHaveCount(0);
});
test("preview an invitation and explicitly confirm joining", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/group/join");
  await page.getByLabel("Invite code").fill("f".repeat(64));
  await page.getByRole("button", { name: "Find group" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "invalid, expired, revoked",
  );
  await page.getByLabel("Invite code").fill(code);
  await page.getByRole("button", { name: "Find group" }).click();
  await expect(
    page.getByRole("heading", { name: "Invitation Preview" }),
  ).toBeVisible();
  await expect(
    page.getByText("Office Friends", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("1 member", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Office Friends", { exact: false }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/group-preview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Join group" }).click();
  await expect(page.getByText("Owner: Alex")).toBeVisible();
});
test("group deep links require authentication", async ({ page }) => {
  for (const path of [
    "/group/create",
    "/group/join",
    `/group/${id}`,
    `/group/${id}/members`,
    `/group/${id}/settings`,
    `/group/${id}/invites`,
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.getByText("Owner: Alex")).toHaveCount(0);
  }
});

test("optional vice setup, appointment, and owner departure warning", async ({
  page,
}) => {
  await fixture(page, true);
  await page.goto("/group/create");
  await page.getByRole("button", { name: "Add a vice owner later" }).click();
  await page.getByLabel("Group name").fill("Friends");
  await page.getByRole("button", { name: "Create Group", exact: true }).click();
  await expect(page).toHaveURL(/members$/);
  await page.getByRole("button", { name: "Make Bob vice owner" }).click();
  await expect(
    page.getByText(/The vice takes over when you leave or delete your account/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Bob as vice owner" }),
  ).toBeVisible();
  await page.goto(`/group/${id}`);
  await expect(
    page.getByText("Vice owner: Bob", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Leave group", exact: true }).click();
  await expect(
    page.getByText("Leave this group? Bob will become the owner."),
  ).toBeVisible();
});
