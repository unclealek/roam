import { test, expect, type Page } from "@playwright/test";
const catalog = [
  {
    id: "secret_santa",
    name: "Secret Santa",
    description:
      "Exchange secret gifts, discover clues and play mystery challenges with friends.",
    category: "Social / Mystery",
    icon_ref: "gift",
    min_players: 3,
    max_players: 100,
    availability_status: "available",
  },
];
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function fixture(
  page: Page,
  { existingSession = false, failFirst = false } = {},
) {
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
    created_at: user.created_at,
    updated_at: user.created_at,
  };
  const session = {
    id,
    host_id: user.id,
    game_type_id: "secret_santa",
    group_id: null,
    name: "Office friends",
    configuration: {},
    status: "draft",
    created_at: user.created_at,
    started_at: null,
    completed_at: null,
    participant_count: 1,
    host: { id: user.id, display_name: "Alex" },
    participants: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        user_id: user.id,
        display_name: "Alex",
        role: "host",
        joined_at: user.created_at,
      },
    ],
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
            sub: user.id,
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
  let catalogRequests = 0;
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
    if (req.url().includes("/game_types")) {
      catalogRequests++;
      if (failFirst && catalogRequests === 1) {
        await route.fulfill({
          status: 403,
          json: { message: "fixture failure" },
          headers,
        });
        return;
      }
      await route.fulfill({ json: catalog, headers });
      return;
    }
    if (req.url().includes("list_my_game_sessions")) {
      await route.fulfill({ json: existingSession ? [session] : [], headers });
      return;
    }
    if (req.url().includes("get_game_session")) {
      await route.fulfill({ json: session, headers });
      return;
    }
    if (req.url().includes("update_game_session")) {
      session.name = req.postDataJSON().p_name;
      await route.fulfill({ json: session, headers });
      return;
    }
    await route.fulfill({
      json: req.url().includes("/profiles") ? profile : { user },
      headers,
    });
  });
}
test("catalog opens Secret Santa setup without drawing or gameplay", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/games");
  await expect(
    page.getByRole("heading", { name: "Secret Santa", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("3–100 players · Available")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mind Match", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Secret Agent", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("No games yet")).toBeVisible();
  await page.screenshot({
    path: "test-results/catalog-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "View Secret Santa" }).click();
  await expect(
    page.getByRole("button", { name: "Create Secret Santa", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /start|draw/i })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Back to Games" }).click();
  await expect(
    page.getByRole("heading", { name: "What shall we play?", exact: true }),
  ).toBeVisible();
  await page.goto("/game/unknown");
  await expect(page.getByText("Game unavailable")).toBeVisible();
});
test("My Games opens reusable session details and saves permitted settings", async ({
  page,
}) => {
  await fixture(page, { existingSession: true });
  await page.goto("/games");
  await page
    .getByRole("button", { name: "View session: Office friends" })
    .click();
  await expect(page.getByText("Host: Alex")).toBeVisible();
  await expect(page.getByText("Status: Draft")).toBeVisible();
  await page.getByLabel("Game name").fill("Team friends");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Team friends", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to Games" }).click();
  await expect(
    page.getByRole("button", { name: "View session: Team friends" }),
  ).toBeVisible();
});
test("catalog failures expose a working retry", async ({ page }) => {
  await fixture(page, { failFirst: true });
  await page.goto("/games");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("button", { name: "View Secret Santa" }),
  ).toBeVisible();
});
test("game and session deep links preserve the authentication gate", async ({
  page,
}) => {
  for (const route of ["/game/secret_santa", `/session/${id}`]) {
    await page.goto(route);
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.getByText("Host: Alex")).toHaveCount(0);
  }
});
