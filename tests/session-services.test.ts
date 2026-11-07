import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  createSessionService,
  type SessionInvoker,
} from "../src/platform/sessions/service";
import {
  createGameRegistry,
  gameRegistry,
} from "../src/platform/games/registry";
import { fixtureGame } from "./fixtures/game";
import { sessionActions } from "../src/platform/sessions/permissions";
import {
  readSessionDetails,
  sessionId,
  sessionName,
} from "../src/platform/sessions/validation";
export const sample = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  host_id: "alice",
  game_type_id: "engine_fixture",
  group_id: null,
  name: "Friends",
  configuration: { rounds: 3 },
  status: "draft" as const,
  participant_count: 1,
  created_at: "2026-10-26T00:00:00Z",
  started_at: null,
  completed_at: null,
};
vi.mock("../src/platform/supabase", () => ({ requireSupabase: vi.fn() }));
const invoke = vi.fn();
const service = createSessionService(
  invoke as SessionInvoker,
  createGameRegistry([...gameRegistry.all(), fixtureGame]),
);
beforeEach(() => {
  vi.resetAllMocks();
  invoke.mockResolvedValue({ data: sample, error: null });
});
describe("session RPC services", () => {
  it("creates a group session without changing standalone contracts", async () => {
    invoke.mockResolvedValue({
      data: { ...sample, group_id: sample.id },
      error: null,
    });
    const result = await service.create({
      gameTypeId: "engine_fixture",
      name: "Friends",
      configuration: { rounds: 3 },
      requestId: sample.id,
      groupId: sample.id,
    });
    expect(result.group_id).toBe(sample.id);
    expect(invoke).toHaveBeenCalledWith("create_group_game_session", {
      p_group_id: sample.id,
      p_game_type_id: "engine_fixture",
      p_name: "Friends",
      p_configuration: { rounds: 3 },
      p_request_id: sample.id,
    });
  });
  it("creates from validated registered configuration without accepting a host id", async () => {
    await service.create({
      gameTypeId: "engine_fixture",
      name: " Friends ",
      configuration: { rounds: 3 },
      requestId: sample.id,
    });
    expect(invoke).toHaveBeenCalledWith("create_game_session", {
      p_game_type_id: "engine_fixture",
      p_name: "Friends",
      p_configuration: { rounds: 3 },
      p_request_id: sample.id,
    });
  });
  it("rejects unknown, unavailable, or malformed creation requests before transport", async () => {
    for (const gameTypeId of ["unknown", "secret_santa"])
      await expect(
        service.create({
          gameTypeId,
          name: "Friends",
          configuration: {},
          requestId: sample.id,
        }),
      ).rejects.toThrow();
    await expect(
      service.create({
        gameTypeId: "engine_fixture",
        name: "Friends",
        configuration: { rounds: 99 },
        requestId: sample.id,
      }),
    ).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
  it("fetches session details and lists only the server-visible sessions", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        ...sample,
        host: { id: "alice", display_name: "Alice" },
        participants: [],
      },
      error: null,
    });
    expect((await service.get(sample.id)).name).toBe("Friends");
    invoke.mockResolvedValueOnce({ data: [sample], error: null });
    expect(await service.list()).toEqual([sample]);
  });
  it("updates only name and validated config, with no membership or host claims", async () => {
    await service.update({
      sessionId: sample.id,
      gameTypeId: "engine_fixture",
      name: "New",
      configuration: { rounds: 4 },
    });
    expect(invoke).toHaveBeenCalledWith("update_game_session", {
      p_session_id: sample.id,
      p_name: "New",
      p_configuration: { rounds: 4 },
    });
  });
  it.each([
    ["join", "join_game_session"],
    ["start", "start_game_session"],
    ["cancel", "cancel_game_session"],
    ["openLobby", "open_game_lobby"],
  ] as const)(
    "delegates %s authorization to its trusted RPC",
    async (method, rpc) => {
      await service[method](sample.id);
      expect(invoke).toHaveBeenCalledWith(rpc, { p_session_id: sample.id });
    },
  );
  it("leaves without taking a user id", async () => {
    invoke.mockResolvedValue({ data: null, error: null });
    await service.leave(sample.id);
    expect(invoke).toHaveBeenCalledWith("leave_game_session", {
      p_session_id: sample.id,
    });
  });
  it("reports transport/authorization failures without exposing backend internals", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: "internal secret" },
    });
    await expect(service.cancel(sample.id)).rejects.toThrow(
      "Unable to complete",
    );
    invoke.mockRejectedValue(new Error("offline"));
    await expect(service.list()).rejects.toThrow();
  });
  it("rejects malformed list/detail responses", async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    await expect(service.list()).rejects.toThrow("Invalid session list");
    await expect(service.get(sample.id)).rejects.toThrow(
      "Invalid session response",
    );
    expect(() =>
      readSessionDetails({ ...sample, host: {}, participants: [] }),
    ).toThrow("Invalid session details");
  });
});
describe("session input validation and UI permissions", () => {
  it("checks identifiers and name boundaries", () => {
    expect(sessionName(" A ")).toBe("A");
    expect(sessionName("a".repeat(120))).toHaveLength(120);
    for (const v of ["", "  ", "a".repeat(121), "a\nb"])
      expect(() => sessionName(v)).toThrow();
    for (const id of ["unknown", "", "../session"])
      expect(() => sessionId(id)).toThrow();
  });
  it("permits only the host to edit, open, start, or cancel", () => {
    expect(sessionActions(sample, "alice", fixtureGame)).toMatchObject({
      edit: true,
      openLobby: true,
      cancel: true,
      start: false,
      leave: false,
    });
    expect(sessionActions(sample, "bob", fixtureGame)).toMatchObject({
      edit: false,
      openLobby: false,
      cancel: false,
      start: false,
      leave: true,
    });
    expect(
      sessionActions(
        { ...sample, status: "lobby", participant_count: 2 },
        "alice",
        fixtureGame,
      ).start,
    ).toBe(true);
    expect(
      sessionActions({ ...sample, status: "active" }, "bob", fixtureGame).leave,
    ).toBe(false);
    expect(
      sessionActions({ ...sample, status: "completed" }, "alice", fixtureGame)
        .cancel,
    ).toBe(false);
    expect(sessionActions(sample, "alice", undefined).openLobby).toBe(false);
  });
});
