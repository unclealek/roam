import { test, expect, type Page } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  code = "ab".repeat(32);
async function fixture(page: Page, participantCount?: number, drawDelay = 0) {
  let revealedAt: string | null = null;
  const now = new Date().toISOString();
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "santa@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: now,
  };
  const group = {
    id,
    name: "Friends",
    description: null,
    icon_key: "people",
    owner_id: id,
    member_count: 2,
    created_at: now,
    updated_at: now,
  };
  let settings: Record<string, any> = {};
  let lobby: Record<string, any> = {};
  let joined = false;
  const invite = {
    id,
    session_id: id,
    code,
    expires_at: "2035-12-10T20:00:00Z",
    revoked_at: null,
    use_count: 0,
  };
  function document() {
    return {
      ...lobby,
      settings,
      server_now: new Date().toISOString(),
      host: { id, display_name: "Alex" },
      participants: [
        { id, user_id: id, display_name: "Alex", role: "host", joined_at: now },
        ...(joined || (participantCount ?? 0) >= 2
          ? [
              {
                id: bob,
                user_id: bob,
                display_name: "Bob",
                role: "member",
                joined_at: now,
              },
            ]
          : []),
        ...((participantCount ?? 0) >= 3
          ? [
              {
                id: "33333333-3333-4333-8333-333333333333",
                user_id: "33333333-3333-4333-8333-333333333333",
                display_name: "Casey",
                role: "member",
                joined_at: now,
              },
            ]
          : []),
      ],
      participant_count: participantCount ?? (joined ? 2 : 1),
      invitations: [invite],
    };
  }
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
        Buffer.from("fixture-only").toString("base64url"),
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
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let data: any = { user };
    const rpc = req.url().split("/rpc/")[1];
    if (req.url().includes("/profiles"))
      data = { id, display_name: "Alex", created_at: now, updated_at: now };
    if (rpc === "list_my_groups") data = [group];
    if (rpc === "list_my_game_sessions") data = lobby.id ? [document()] : [];
    if (rpc === "get_game_session") data = document();
    if (req.url().includes("/game_types"))
      data = [
        {
          id: "secret_santa",
          name: "Secret Santa",
          description:
            "Exchange secret gifts and discover mysteries with friends.",
          category: "Social / Mystery",
          icon_ref: "gift",
          min_players: 3,
          max_players: 100,
          availability_status: "available",
        },
      ];
    if (rpc === "secret_santa_lobby") {
      const body = req.postDataJSON();
      switch (body.p_action) {
        case "create":
          settings = {
            ...body.p_data.settings,
            session_id: id,
            lobby_phase: "joining_open",
            joining_closed_at: null,
            created_at: now,
            updated_at: now,
          };
          lobby = {
            id,
            name: body.p_data.name,
            game_type_id: "secret_santa",
            host_id: id,
            group_id: body.p_data.group_id,
            status: "lobby",
            configuration: {},
            created_at: now,
            started_at: null,
            completed_at: null,
          };
          data = { ...document(), invitation: invite };
          break;
        case "draw":
          if (drawDelay)
            await new Promise((resolve) => setTimeout(resolve, drawDelay));
          lobby.status = "active";
          settings.lobby_phase = "matched";
          settings.matched_at = now;
          data = document();
          break;
        case "assignment":
        case "reveal":
          if (body.p_action === "reveal") revealedAt ??= now;
          data = {
            session_id: id,
            name: lobby.name,
            status: "active",
            settings,
            server_now: now,
            revealed_at: revealedAt,
            recipient: revealedAt
              ? { display_name: "Robin", available: true }
              : null,
          };
          break;
        case "get":
          data = document();
          break;
        case "preview":
          data = {
            id,
            name: lobby.name,
            participant_count: 1,
            joining_deadline: settings.joining_deadline,
            exchange_date: settings.exchange_date,
          };
          break;
        case "redeem":
          joined = true;
          data = document();
          break;
        case "edit":
          settings = { ...settings, ...body.p_data.settings };
          lobby.name = body.p_data.name;
          data = document();
          break;
        case "close":
          settings.lobby_phase = "insufficient_players";
          settings.joining_closed_at = now;
          data = document();
          break;
        case "extend":
          settings.joining_deadline = body.p_data.joining_deadline;
          settings.lobby_phase = "joining_open";
          settings.joining_closed_at = null;
          data = document();
          break;
        case "cancel":
          lobby.status = "cancelled";
          data = document();
          break;
        case "invite":
          data = invite;
          break;
        case "revoke":
          invite.revoked_at = now as never;
          data = document();
          break;
        case "group_lobbies":
          data = [];
          break;
        default:
          data = null;
      }
    }
    await route.fulfill({ json: data, headers });
  });
  return { get: () => document() };
}
test("create standalone Secret Santa, edit settings, close insufficient, extend, and cancel", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/game/secret_santa");
  await page
    .getByRole("button", { name: "Create Secret Santa", exact: true })
    .click();
  await expect(page.getByLabel("Game name")).toHaveValue(
    "Secret Santa with Friends",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByLabel("Joining deadline", { exact: true })
    .fill("2035-12-10T20:00");
  await page
    .getByLabel("Gift exchange date", { exact: true })
    .fill("2035-12-25");
  await page.getByLabel("Suggested gift budget (optional)").fill("25");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Mind Match: Off", exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(page).toHaveURL(/lobby\//);
  await expect(
    page.getByText("1 / 100 participants · minimum 3"),
  ).toBeVisible();
  await expect(page.getByLabel("Your invite code")).toHaveValue(code);
  await page.screenshot({
    path: "test-results/secret-santa-lobby.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Edit game settings", exact: true })
    .click();
  await page.getByLabel("Game name", { exact: true }).fill("Winter gifts");
  for (let step = 0; step < 3; step++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Winter gifts", exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close joining early", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm lobby action", exact: true })
    .click();
  await expect(page.getByText("Status: Needs host attention")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit game settings", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("New joining deadline", { exact: true })
    .fill("2035-12-12T20:00");
  await page
    .getByRole("button", { name: "Extend joining deadline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm lobby action", exact: true })
    .click();
  await expect(page.getByText("Status: Joining open")).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel gift exchange", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm lobby action", exact: true })
    .click();
  await expect(page.getByText("Status: Cancelled")).toBeVisible();
});
test("select a persistent group and use safe invitation preview with explicit confirmation", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/game/secret_santa/create");
  await page.getByRole("button", { name: "Friends", exact: true }).click();
  for (let step = 0; step < 3; step++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(
    page.getByText(/For group games, join the group first/),
  ).toBeVisible();
  await page.goto(`/game/secret_santa/join?code=${code}`);
  await page.getByRole("button", { name: "Find game", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Join Secret Santa",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Host: Alex")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Join Secret Santa", exact: true })
    .click();
  await expect(
    page.getByText("2 / 100 participants · minimum 3"),
  ).toBeVisible();
});
test("Secret Santa setup, join and lobby routes require authentication", async ({
  page,
}) => {
  for (const route of [
    "/game/secret_santa/create",
    "/game/secret_santa/join",
    `/game/secret_santa/lobby/${id}`,
    `/game/secret_santa/recipient/${id}`,
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("button", { name: "Continue with Google", exact: true }),
    ).toBeVisible();
  }
});

test("confirm early draw, privately reveal, continue and revisit", async ({
  page,
}) => {
  await fixture(page, 3, 1200);
  await page.goto("/game/secret_santa/create");
  await expect(page.getByLabel("Game name", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/santa-setup.png",
    fullPage: true,
    animations: "disabled",
  });
  for (let step = 0; step < 3; step++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create Game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Draw names", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/santa-ready-for-draw.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Draw names", exact: true }).click();
  await expect(page.getByText(/Joining will close and/)).toBeVisible();
  await expect
    .poll(() =>
      page.getByRole("alertdialog").evaluate((el) => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          if (getComputedStyle(node).opacity !== "1") return false;
        }
        return true;
      }),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/santa-draw-confirmation.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Start Draw", exact: true }).click();
  await expect(page.getByText("Secret Santa draw")).toBeVisible();
  await page.screenshot({
    path: "test-results/santa-drawing.png",
    fullPage: true,
    animations: "disabled",
  });
  await expect(page.getByText("Status: Game Started")).toBeVisible();
  await page.screenshot({
    path: "test-results/santa-assignment-ready.png",
    fullPage: true,
    animations: "disabled",
  });
  await expect(
    page.getByRole("button", { name: "Draw names", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reveal My Recipient", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My Recipient", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Your recipient is ready/)).toBeVisible();
  await expect(page.getByText("Robin", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: "test-results/secret-santa-wrapped.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Reveal my recipient", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Robin", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Keep it secret/)).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Robin", exact: true })
      .locator("..")
      .locator("..")
      .locator(".."),
  ).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "test-results/secret-santa-recipient.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Reveal My Recipient", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Robin", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Robin", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reveal my recipient", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/santa-my-recipient.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("introduction and setup fit small dark screens with reduced motion", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/game/secret_santa");
  await expect(
    page.getByRole("button", { name: "Create Secret Santa", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("How it works", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/santa-introduction-dark-small.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Create Secret Santa", exact: true })
    .click();
  await expect(page.getByLabel("Game name")).toBeVisible();
  await page.screenshot({
    path: "test-results/santa-setup-dark-small.png",
    fullPage: true,
    animations: "disabled",
  });
});
