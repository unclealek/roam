import { describe, it, expect, vi } from "vitest";
import {
  createGroupService,
  validateGroup,
  invitationCode,
} from "../src/platform/groups/service";
vi.mock("../src/platform/supabase", () => ({ requireSupabase: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const group = {
  id,
  name: "Friends",
  description: null,
  icon_key: null,
  owner_id: id,
  member_count: 1,
  created_at: "2026-10-27",
  updated_at: "2026-10-27",
};
describe("group client contracts", () => {
  it("trims and validates names, descriptions, icons and codes", () => {
    expect(validateGroup({ name: " Friends ", description: " " })).toEqual({
      name: "Friends",
      description: null,
      icon_key: null,
    });
    for (const name of ["", "x".repeat(81), "bad\nname"])
      expect(() => validateGroup({ name })).toThrow();
    expect(() =>
      validateGroup({ name: "ok", description: "x".repeat(501) }),
    ).toThrow();
    expect(() => validateGroup({ name: "ok", icon_key: "evil" })).toThrow();
    expect(invitationCode(" A".trim().repeat(64))).toBe("a".repeat(64));
    expect(() => invitationCode("bad")).toThrow();
  });
  it("creates and lists with trusted RPCs", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: group, error: null });
    const service = createGroupService(invoke);
    expect(await service.create({ name: " Friends " })).toEqual(group);
    expect(invoke).toHaveBeenCalledWith("create_group", {
      p_name: "Friends",
      p_description: null,
      p_icon_key: null,
    });
    invoke.mockResolvedValue({ data: [group], error: null });
    expect(await service.list()).toEqual([group]);
  });
  it("maps expected invitation failures and hides raw server errors", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: { error: "unavailable" }, error: null });
    const service = createGroupService(invoke);
    await expect(service.preview("a".repeat(64))).rejects.toThrow(
      /expired|revoked/,
    );
    invoke.mockResolvedValue({ data: { error: "rate_limited" }, error: null });
    await expect(service.join("a".repeat(64))).rejects.toThrow(/Too many/);
    invoke.mockResolvedValue({ error: { message: "secret SQL" }, data: null });
    await expect(service.list()).rejects.toThrow(/connection/);
  });
  it("rejects malformed responses", async () => {
    const service = createGroupService(
      vi.fn().mockResolvedValue({ data: {}, error: null }),
    );
    await expect(service.list()).rejects.toThrow(/response/);
    await expect(service.get(id)).rejects.toThrow(/response/);
    await expect(service.preview("a".repeat(64))).rejects.toThrow(/response/);
  });
});

describe("group management transport and response validation", () => {
  it("reads details and sends only authorized operation arguments", async () => {
    const detail = {
      ...group,
      members: [{ user_id: id, display_name: "Alice", role: "owner" }],
      sessions: [],
      invites: [],
    };
    const invoke = vi.fn().mockResolvedValue({ data: detail, error: null });
    const s = createGroupService(invoke);
    expect((await s.get(id)).members).toHaveLength(1);
    await s.update(id, {
      name: " New ",
      description: "Description",
      icon_key: "coffee",
    });
    expect(invoke).toHaveBeenLastCalledWith("update_group", {
      p_group_id: id,
      p_name: "New",
      p_description: "Description",
      p_icon_key: "coffee",
    });
    for (const [method, rpcName] of [
      ["leave", "leave_group"],
      ["delete", "delete_group"],
    ] as const) {
      await s[method](id);
      expect(invoke).toHaveBeenLastCalledWith(rpcName, { p_group_id: id });
    }
    for (const [method, rpcName] of [
      ["remove", "remove_group_member"],
      ["transfer", "transfer_group_ownership"],
    ] as const) {
      await s[method](id, id);
      expect(invoke).toHaveBeenLastCalledWith(rpcName, {
        p_group_id: id,
        p_user_id: id,
      });
    }
    await s.revoke(id, id);
    expect(invoke).toHaveBeenLastCalledWith("revoke_group_invite", {
      p_group_id: id,
      p_invite_id: id,
    });
    invoke.mockResolvedValue({
      data: { ...group, code: "a".repeat(64) },
      error: null,
    });
    expect((await s.invite(id, 3, 2)).code).toBe("a".repeat(64));
    expect(invoke).toHaveBeenLastCalledWith("create_group_invite", {
      p_group_id: id,
      p_days: 3,
      p_max_uses: 2,
    });
    invoke.mockResolvedValue({ data: group, error: null });
    expect(await s.join("a".repeat(64))).toEqual(group);
    expect(await s.preview("a".repeat(64))).toEqual(group);
  });
  it("rejects invalid limits and identifiers before making requests", async () => {
    const invoke = vi.fn();
    const s = createGroupService(invoke);
    for (const [days, uses] of [
      [0, null],
      [31, null],
      [1, 0],
      [1, 1.5],
      [1, 2147483648],
    ] as const)
      await expect(s.invite(id, days, uses)).rejects.toThrow();
    await expect(s.get("bad")).rejects.toThrow();
    await expect(s.remove(id, "bad")).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
  it("rejects malformed group and invitation payloads", async () => {
    const invoke = vi.fn();
    const s = createGroupService(invoke);
    for (const payload of [null, [], {}, { ...group, owner_id: undefined }]) {
      invoke.mockResolvedValue({ data: payload, error: null });
      await expect(s.create({ name: "Test" })).rejects.toThrow(/response/);
    }
    for (const payload of [
      { ...group, members: [], sessions: [] },
      {
        ...group,
        members: [{ user_id: id, display_name: 1, role: "owner" }],
        sessions: [],
        invites: [],
      },
    ]) {
      invoke.mockResolvedValue({ data: payload, error: null });
      await expect(s.get(id)).rejects.toThrow(/response/);
    }
    invoke.mockResolvedValue({ data: { id }, error: null });
    await expect(s.invite(id)).rejects.toThrow(/response/);
  });
});

it("validates vice IDs and sends only the group and selected member", async () => {
  const invoke = vi.fn().mockResolvedValue({ data: null, error: null });
  const s = createGroupService(invoke);
  await s.setVice(id, id);
  expect(invoke).toHaveBeenLastCalledWith("set_group_vice_owner", {
    p_group_id: id,
    p_user_id: id,
  });
  await s.setVice(id, null);
  expect(invoke).toHaveBeenLastCalledWith("set_group_vice_owner", {
    p_group_id: id,
    p_user_id: null,
  });
  await expect(s.setVice(id, "bad")).rejects.toThrow();
  invoke.mockResolvedValue({
    data: null,
    error: {
      message: "Appoint a vice owner or transfer ownership before leaving",
    },
  });
  await expect(s.leave(id)).rejects.toThrow(/Appoint a vice/);
});
