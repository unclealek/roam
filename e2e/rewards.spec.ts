import { test, expect, type Page } from "@playwright/test";
const id = "11111111-1111-4111-8111-111111111111";
async function fixture(page: Page) {
  const now = new Date().toISOString();
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "rewards-fixture@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: now,
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
  let earned = false;
  const cards = [
    ["first_steps", "First Steps", "common", "Complete your first game."],
    [
      "mind_reader",
      "Mind Reader",
      "rare",
      "Reach a verified Mind Match prediction milestone.",
    ],
    [
      "gift_detective",
      "Gift Detective",
      "uncommon",
      "Discover gift preferences in Secret Santa.",
    ],
    [
      "mystery_solver",
      "Mystery Solver",
      "legendary",
      "Make a successful Secret Agent prediction.",
    ],
    [
      "dedicated_explorer",
      "Dedicated Explorer",
      "uncommon",
      "Participate across three game types.",
    ],
  ].map(([key, name, rarity, description]) => ({
    id: key,
    name,
    rarity,
    description: "A moment worth keeping.",
    artwork_key: key,
    game_type_id: null,
    unlock_rule: { description },
    created_at: now,
    owned_id: null as string | null,
    unlocked_at: null as string | null,
    earned_session_id: null,
  }));
  const dashboard = () => ({
    progress: {
      total_xp: earned ? 200 : 0,
      level: earned ? 2 : 1,
      level_xp: earned ? 100 : 0,
      next_level_xp: earned ? 250 : 100,
      xp_into_level: earned ? 100 : 0,
      xp_to_next_level: earned ? 50 : 100,
      progress: earned ? 2 / 3 : 0,
    },
    game_progress: earned
      ? [{ game_type_id: "fixture", game_name: "Example game", total_xp: 200 }]
      : [],
    collectibles: cards,
    achievements: [
      {
        id: "first_game",
        name: "First game complete",
        description: "Complete your first game.",
        scope: "global",
        criteria: { description: "Complete your first game." },
        earned_id: earned ? "first" : null,
        unlocked_at: earned ? now : null,
      },
    ],
    history: earned
      ? [
          {
            id,
            amount: 100,
            source_event_key: "first_game_completed",
            created_at: now,
          },
        ]
      : [],
  });
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
    if (req.url().includes("/notification_account"))
      data = { items: [], unread_count: 0 };
    if (req.url().includes("/reward_account")) {
      const { p_action, p_data } = req.postDataJSON();
      data =
        p_action === "card"
          ? (cards.find((c) => c.id === p_data.card_id) ?? null)
          : p_action === "history"
            ? []
            : p_action === "achievements"
              ? dashboard().achievements
              : p_action === "progress"
                ? dashboard().progress
                : dashboard();
    }
    await route.fulfill({ json: data, headers });
  });
  return {
    earn() {
      earned = true;
      cards[0].unlocked_at = now;
      cards[0].owned_id = "owned";
    },
  };
}
test("zero rewards, locked collection, verified updates and earned card details", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/rewards");
  await expect(
    page.getByRole("heading", { name: "Level 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("100 XP to level 2")).toBeVisible();
  await page
    .getByRole("button", { name: "View First Steps card, locked" })
    .click();
  await expect(
    page
      .getByText("Complete your first game.", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "First Steps", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Locked", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to rewards" }).click();
  await expect(
    page.getByRole("heading", { name: "Level 1", exact: true }),
  ).toBeVisible();
  backend.earn();
  await page.getByRole("button", { name: "Refresh rewards" }).click();
  await expect(page.getByText("+200 XP earned", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Level 2 reached", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("First Steps card unlocked", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Achievement earned: First game complete", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("+200 XP earned", { exact: true }).locator("../.."),
  ).toHaveCSS("opacity", "1");

  await page
    .getByText("+200 XP earned", { exact: true })
    .locator("..")
    .screenshot({
      path: "test-results/scope0754-xp.png",
      animations: "disabled",
    });
  await page
    .getByText("Level 2 reached", { exact: true })
    .locator("..")
    .screenshot({
      path: "test-results/scope0754-level-up.png",
      animations: "disabled",
    });
  await page
    .getByText("Achievement earned: First game complete", { exact: true })
    .locator("..")
    .screenshot({
      path: "test-results/scope0754-achievement.png",
      animations: "disabled",
    });
  await page
    .getByRole("button", { name: "Reveal First Steps", exact: true })
    .click();
  await page
    .getByText("First Steps card unlocked", { exact: true })
    .locator("..")
    .screenshot({
      path: "test-results/scope0754-collectible-reveal.png",
      animations: "disabled",
    });
  while (
    await page.getByRole("button", { name: "Continue", exact: true }).count()
  )
    await page
      .getByRole("button", { name: "Continue", exact: true })
      .first()
      .click();
  const dismissXP = page.getByRole("button", {
    name: "Done",
    exact: true,
  });
  if (await dismissXP.count()) await dismissXP.click();
  await page
    .getByRole("heading", { name: "Rewards", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/scope05-rewards.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View Mind Reader card, locked" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/scope05-collection.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View First Steps card, unlocked" })
    .click();
  await expect(
    page.getByText(/^Earned /).filter({ visible: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/scope05-card.png",
    fullPage: true,
  });
});
test("reduced-motion rewards remain navigable, and unknown cards have an empty state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const backend = await fixture(page);
  await page.goto("/rewards");
  await expect(
    page.getByRole("heading", { name: "Level 1", exact: true }),
  ).toBeVisible();
  backend.earn();
  await page.getByRole("button", { name: "Refresh rewards" }).click();
  await expect(
    page.getByText("Level 2 reached", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View First Steps card, unlocked" })
    .click();
  await expect(
    page.getByText(/^Earned /).filter({ visible: true }),
  ).toBeVisible();
  await page.goto("/collectible/unknown");
  await expect(page.getByText("Card not found", { exact: true })).toBeVisible();
});
test("rewards and collectible deep links require authentication", async ({
  page,
}) => {
  for (const route of ["/rewards", "/collectible/first_steps"]) {
    await page.goto(route);
    if (route === "/rewards") {
      await page.getByRole("button", { name: "Tap anywhere to begin" }).click();
      await page.getByRole("button", { name: "Sign in" }).click();
    }
    await expect(
      page.getByRole("button", { name: "Continue with Apple" }),
    ).toBeVisible();
  }
});

test("achievement detail and acknowledged celebrations survive a reload", async ({
  page,
}) => {
  const backend = await fixture(page);
  await page.goto("/rewards");
  await expect(page.getByText("0 XP", { exact: true })).toBeVisible();
  backend.earn();
  await page
    .getByRole("button", { name: "Refresh rewards", exact: true })
    .click();
  await expect(
    page.getByText("Level 2 reached", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Level 2", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Level 2 reached", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", {
      name: "View First game complete achievement, unlocked",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/^Earned /).filter({ visible: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/scope0754-achievement-details.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Back to rewards", exact: true })
    .click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(
    page.getByRole("heading", { name: "Level 2", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/scope0754-rewards-dark-small.png",
    fullPage: true,
    animations: "disabled",
  });
});
