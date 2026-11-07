const { Buffer } = require("node:buffer");
// Disposable UI fixture only. Never forwards requests to a remote service.
const ids = {
  alice: "11111111-1111-4111-8111-111111111111",
  bob: "22222222-2222-4222-8222-222222222222",
  group: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  session: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  past: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  invite: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};
function uuid(n) {
  return `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`;
}
function createAuditBackend(options = {}) {
  const now = new Date().toISOString();
  const user = {
    id: ids.alice,
    aud: "authenticated",
    role: "authenticated",
    email: "button-audit@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: now,
  };
  const sessionToken = {
    access_token: [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url"),
      "DISPOSABLE_FIXTURE_SIGNATURE",
    ].join("."),
    refresh_token: "button-audit-fixture",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  };
  const profile = {
    id: user.id,
    display_name: "Alex",
    created_at: now,
    updated_at: now,
  };
  const group = {
    id: ids.group,
    name: "Audit Friends",
    description: "Disposable button test",
    icon_key: "coffee",
    owner_id: options.role === "member" ? ids.bob : ids.alice,
    member_count: 2,
    created_at: now,
    updated_at: now,
  };
  const members = [
    {
      user_id: ids.alice,
      display_name: "Alex",
      role: options.role === "member" ? "member" : "owner",
      joined_at: now,
    },
    {
      user_id: ids.bob,
      display_name: "Blair",
      role: options.role === "member" ? "owner" : "member",
      joined_at: now,
    },
  ];
  const session = {
    id: ids.session,
    host_id: options.role === "member" ? ids.bob : ids.alice,
    game_type_id: "secret_santa",
    group_id: ids.group,
    name: "Audit session",
    configuration: {},
    status: "draft",
    created_at: now,
    started_at: null,
    completed_at: null,
    participant_count: 2,
    host: {
      id: options.role === "member" ? ids.bob : ids.alice,
      display_name: options.role === "member" ? "Blair" : "Alex",
    },
    participants: members.map((m, i) => ({
      id: uuid(100 + i),
      user_id: m.user_id,
      display_name: m.display_name,
      role: m.role === "owner" ? "host" : "member",
      joined_at: now,
    })),
  };
  const prefs = {
    user_id: user.id,
    push_enabled: options.pushEnabled ?? false,
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
    timezone: "Europe/Helsinki",
    updated_at: now,
  };
  const cards = [
    ["first_steps", "First Steps", "common", "Complete your first game."],
    ["mind_reader", "Mind Reader", "rare", "A future Mind Match milestone."],
    [
      "gift_detective",
      "Gift Detective",
      "uncommon",
      "A future Secret Santa milestone.",
    ],
    [
      "mystery_solver",
      "Mystery Solver",
      "legendary",
      "A future Secret Agent milestone.",
    ],
    [
      "dedicated_explorer",
      "Dedicated Explorer",
      "uncommon",
      "Participate across three game types.",
    ],
  ].map(([id, name, rarity, description], i) => ({
    id,
    name,
    rarity,
    description: "A shared moment worth collecting.",
    artwork_key: id,
    game_type_id: null,
    unlock_rule: { description },
    created_at: now,
    owned_id: i === 0 ? uuid(999) : null,
    unlocked_at: i === 0 ? now : null,
    earned_session_id: i === 0 ? session.id : null,
  }));
  const history = Array.from({ length: 31 }, (_, i) => ({
    id: uuid(1000 + i),
    user_id: user.id,
    game_session_id: session.id,
    game_type_id: "secret_santa",
    reward_definition_id: "activity_completed",
    amount: 20,
    idempotency_key: `activity:${i}`,
    source_event_key: "activity_completed",
    source_id: uuid(2000 + i),
    source_session_id: session.id,
    created_at: new Date(Date.now() - i * 1000).toISOString(),
  }));
  const notifications = Array.from({ length: 31 }, (_, i) => ({
    id: uuid(i + 1),
    user_id: user.id,
    category: "game_updates",
    template_key: "game_started",
    title: `Audit notification ${i + 1}`,
    body: "Disposable local fixture notification.",
    route:
      i === 0
        ? "/rewards"
        : i === 1
          ? `/group/${group.id}`
          : `/session/${session.id}`,
    related_session_id: session.id,
    read_at: null,
    created_at: new Date(Date.now() - i * 1000).toISOString(),
    event_key: `fixture:${i}`,
  }));
  const state = {
    user,
    sessionToken,
    profile,
    group,
    members,
    session,
    prefs,
    cards,
    history,
    notifications,
    invites: [],
    hasGroup: options.initialGroup ?? true,
    hasSessions: options.sessions ?? true,
    calls: [],
    failures: {},
  };
  const ok = (json) => ({ status: 200, json });
  const fail = (message, status = 400) => ({
    status,
    json: { message, code: "FIXTURE_FAILURE" },
  });
  function dashboard() {
    return {
      progress: {
        total_xp: 620,
        level: 4,
        level_xp: 500,
        next_level_xp: 850,
        xp_into_level: 120,
        xp_to_next_level: 230,
        progress: 120 / 350,
      },
      game_progress: [
        {
          game_type_id: "secret_santa",
          game_name: "Secret Santa",
          total_xp: 620,
        },
      ],
      collectibles: cards,
      achievements: [
        {
          id: "first_game",
          name: "First game complete",
          description: "Complete your first game.",
          scope: "global",
          earned_id: uuid(800),
          unlocked_at: now,
        },
      ],
      history: history.slice(0, 30),
    };
  }
  function handle(method, rawUrl, data = {}) {
    const url = new URL(rawUrl, "http://127.0.0.1:54321");
    const action = url.pathname.split("/rpc/")[1] ?? url.pathname;
    state.calls.push({ method, action, data });
    if (state.failures[action] > 0) {
      state.failures[action]--;
      return fail("Deliberate local fixture failure", 503);
    }
    if (url.pathname === "/auth/v1/user") return ok({ user });
    if (url.pathname === "/auth/v1/token") return ok(sessionToken);
    if (url.pathname === "/auth/v1/logout") return { status: 204 };
    if (url.pathname === "/auth/v1/authorize") {
      const redirect = new URL(
        url.searchParams.get("redirect_to") ||
          "http://127.0.0.1:4174/auth/callback",
      );
      // Apple demonstrates callback error recovery; Google signs in to the disposable account.
      if (url.searchParams.get("provider") === "apple")
        redirect.searchParams.set("error", "access_denied");
      else redirect.searchParams.set("code", "DISPOSABLE_TEST_CODE");
      return { status: 302, location: redirect.toString() };
    }
    if (url.pathname.endsWith("/profiles")) {
      if (method === "PATCH") {
        if (!data.display_name?.trim()) return fail("Name required");
        profile.display_name = data.display_name;
        profile.updated_at = new Date().toISOString();
      }
      return ok(profile);
    }
    if (url.pathname.endsWith("/game_types"))
      return ok([
        {
          id: "secret_santa",
          name: "Secret Santa",
          description: "Reserved game. No gameplay is enabled.",
          category: "Social / Mystery",
          icon_ref: "gift",
          min_players: 2,
          max_players: null,
          availability_status: "coming_soon",
        },
      ]);
    switch (action) {
      case "secret_santa_lobby":
        return ok([]);
      case "list_my_groups":
        return ok(state.hasGroup ? [group] : []);
      case "get_group":
        return state.hasGroup
          ? ok({
              ...group,
              member_count: members.length,
              members,
              sessions: state.hasSessions
                ? [
                    session,
                    {
                      ...session,
                      id: ids.past,
                      name: "Past audit session",
                      status: "completed",
                      started_at: now,
                      completed_at: now,
                    },
                  ]
                : [],
              invites: state.invites,
            })
          : fail("Group unavailable", 403);
      case "create_group":
        Object.assign(group, {
          name: data.p_name,
          description: data.p_description,
          icon_key: data.p_icon_key,
          updated_at: new Date().toISOString(),
        });
        state.hasGroup = true;
        state.hasSessions = false;
        return ok(group);
      case "update_group":
        Object.assign(group, {
          name: data.p_name,
          description: data.p_description,
          icon_key: data.p_icon_key,
          updated_at: new Date().toISOString(),
        });
        return ok(group);
      case "leave_group":
        state.hasGroup = false;
        return ok(null);
      case "remove_group_member":
        state.members.splice(
          state.members.findIndex((m) => m.user_id === data.p_user_id),
          1,
        );
        group.member_count = members.length;
        return ok(null);
      case "transfer_group_ownership":
        group.owner_id = data.p_user_id;
        members.forEach(
          (m) => (m.role = m.user_id === data.p_user_id ? "owner" : "member"),
        );
        return ok(null);
      case "delete_group":
        if (state.hasSessions)
          return fail("Groups with sessions cannot be deleted");
        state.hasGroup = false;
        return ok(null);
      case "create_group_invite": {
        const invite = {
          id: ids.invite,
          group_id: group.id,
          expires_at: new Date(
            Date.now() + 86400000 * data.p_days,
          ).toISOString(),
          revoked_at: null,
          max_uses: data.p_max_uses,
          use_count: 0,
          created_at: now,
        };
        state.invites.push(invite);
        return ok({ ...invite, code: "ab".repeat(32) });
      }
      case "revoke_group_invite":
        state.invites.find((i) => i.id === data.p_invite_id).revoked_at =
          new Date().toISOString();
        return ok(null);
      case "preview_group_invite":
        return data.p_code === "ab".repeat(32)
          ? ok(group)
          : ok({ error: "unavailable" });
      case "redeem_group_invite":
        state.hasGroup = true;
        return ok(group);
      case "list_my_game_sessions":
        return ok(state.hasSessions ? [session] : []);
      case "get_game_session":
        return ok(
          data.p_session_id === ids.past
            ? {
                ...session,
                id: ids.past,
                name: "Past audit session",
                status: "completed",
                started_at: now,
                completed_at: now,
              }
            : session,
        );
      case "update_game_session":
        session.name = data.p_name;
        return ok(session);
      case "notification_account": {
        const d = data.p_data || {};
        switch (data.p_action) {
          case "list": {
            const start = d.before_id
              ? notifications.findIndex((n) => n.id === d.before_id) + 1
              : 0;
            return ok({
              items: notifications.slice(start, start + 30),
              unread_count: notifications.filter((n) => !n.read_at).length,
            });
          }
          case "read": {
            const n = notifications.find((n) => n.id === d.id);
            if (n)
              n.read_at = d.read === false ? null : new Date().toISOString();
            return ok(true);
          }
          case "preferences":
            return ok(prefs);
          case "save_preferences":
            if (
              !["UTC", "Europe/Helsinki", "America/New_York"].includes(
                d.timezone,
              ) ||
              !/^\d\d:\d\d(?::\d\d)?$/.test(d.preferred_reminder_time)
            )
              return fail("Invalid preferences");
            Object.assign(prefs, d);
            return ok(prefs);
          default:
            return ok(true);
        }
      }
      case "reward_account": {
        const d = data.p_data || {};
        if (data.p_action === "progress") return ok(dashboard().progress);
        if (data.p_action === "achievements")
          return ok(dashboard().achievements);
        if (data.p_action === "card")
          return ok(cards.find((c) => c.id === d.card_id) ?? null);
        if (data.p_action === "history") {
          const start = d.before_id
            ? history.findIndex((x) => x.id === d.before_id) + 1
            : 0;
          return ok(history.slice(start, start + 30));
        }
        return ok(dashboard());
      }
      case "delete_own_account":
        state.deleted = true;
        return ok(null);
      default:
        return fail(`Unsupported fixture operation: ${action}`, 404);
    }
  }
  return { state, ids, handle };
}
module.exports = { createAuditBackend, ids };
