import { it, expect, vi } from "vitest";
import { createSantaService } from "../src/games/secret-santa/service";
import {
  rememberSantaInvitation,
  pendingSantaInvitation,
  clearSantaInvitation,
} from "../src/games/secret-santa/pending-invitation";
vi.mock("../src/platform/supabase", () => ({ requireSupabase: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const code = "ab".repeat(32);
const settings = {
  joining_deadline: "2035-12-10T20:00:00Z",
  exchange_date: "2035-12-25",
  exchange_timezone: "Europe/Helsinki",
  currency_code: "EUR",
  max_participants: 100,
  identity_reveal_enabled: true,
  mind_match_enabled: false,
  secret_agent_enabled: false,
  secret_missions_enabled: false,
};
it("sends validated setup settings, request id and group without player IDs", async () => {
  const invoke = vi.fn().mockResolvedValue({ data: { id }, error: null });
  const s = createSantaService(invoke);
  await s.create(" Friends ", settings, id, null);
  expect(invoke).toHaveBeenCalledWith(
    "create",
    null,
    expect.objectContaining({
      name: "Friends",
      request_id: id,
      group_id: null,
    }),
  );
  await expect(s.create("", settings, id, null)).rejects.toThrow();
  await expect(
    s.create("ok", { ...settings, budget_amount: -1 }, id, null),
  ).rejects.toThrow();
});
it("supports typed host actions, previews, explicit joining and independent group opt-in", async () => {
  const invoke = vi.fn().mockResolvedValue({ data: { id }, error: null });
  const s = createSantaService(invoke);
  await s.get(id);
  await s.edit(id, "Friends", settings);
  await s.preview(code);
  await s.redeem(code);
  await s.join(id);
  await s.leave(id);
  await s.close(id);
  await s.cancel(id);
  await s.invite(id);
  await s.revoke(id, id);
  await s.remove(id, id);
  await s.extend(id, settings.joining_deadline);
  await s.groupLobbies(id);
  expect(invoke.mock.calls.map((c) => c[0])).toEqual([
    "get",
    "edit",
    "preview",
    "redeem",
    "join",
    "leave",
    "close",
    "cancel",
    "invite",
    "revoke",
    "remove",
    "extend",
    "group_lobbies",
  ]);
});
it("rejects invalid IDs/codes, transport failures and rate-limit results safely", async () => {
  const invoke = vi
    .fn()
    .mockResolvedValue({ data: { error: "rate_limited" }, error: null });
  const s = createSantaService(invoke);
  await expect(s.preview(code)).rejects.toThrow(/five minutes/);
  invoke.mockResolvedValue({ data: { error: "unavailable" }, error: null });
  await expect(s.redeem(code)).rejects.toThrow(/unavailable/);
  invoke.mockResolvedValue({ data: 1, error: null });
  await expect(s.get(id)).rejects.toThrow(/Invalid/);
  invoke.mockResolvedValue({ data: null, error: new Error("internal secret") });
  await expect(s.get(id)).rejects.toThrow(/could not/);
  await expect(s.get("bad")).rejects.toThrow();
  await expect(s.preview("bad")).rejects.toThrow();
});
it("preserves only a validated fixed invitation route through sign-in", () => {
  clearSantaInvitation();
  for (const value of ["https://evil.test", code + "?redirect=evil", null])
    rememberSantaInvitation(value);
  expect(pendingSantaInvitation()).toBeNull();
  rememberSantaInvitation(code.toUpperCase());
  expect(pendingSantaInvitation()).toBe(`/game/secret_santa/join?code=${code}`);
  clearSantaInvitation();
  expect(pendingSantaInvitation()).toBeNull();
});

it("draw and private retrieval never accept a giver ID or a client-generated map", async () => {
  const invoke = vi.fn().mockResolvedValue({ data: {}, error: null });
  const service = createSantaService(invoke);
  await service.draw(id);
  await service.getMySecretSantaAssignment(id);
  await service.reveal(id);
  expect(invoke.mock.calls).toEqual([
    ["draw", id, {}],
    ["assignment", id, {}],
    ["reveal", id, {}],
  ]);
  await expect(
    service.getMySecretSantaAssignment("not-a-uuid"),
  ).rejects.toThrow();
});
