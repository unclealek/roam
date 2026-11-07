import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadProfile, saveProfile } from "../src/platform/profiles/service";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
}));
vi.mock("../src/platform/supabase", () => ({
  requireSupabase: () => ({ from: mocks.from }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  const chain = {
    select: mocks.select,
    eq: mocks.eq,
    single: mocks.single,
    update: mocks.update,
  };
  mocks.from.mockReturnValue(chain);
  mocks.select.mockReturnValue(chain);
  mocks.eq.mockReturnValue(chain);
  mocks.update.mockReturnValue(chain);
  mocks.single.mockResolvedValue({
    data: { id: "alice", display_name: "Alice" },
    error: null,
  });
});
describe("profile service", () => {
  it("loads only the requested profile", async () => {
    expect((await loadProfile("alice")).display_name).toBe("Alice");
    expect(mocks.eq).toHaveBeenCalledWith("id", "alice");
  });
  it("normalizes a display name and updates no other fields", async () => {
    await saveProfile("alice", " Alice ");
    expect(mocks.update).toHaveBeenCalledWith({ display_name: "Alice" });
    expect(mocks.eq).toHaveBeenCalledWith("id", "alice");
  });
  it("rejects invalid names before a network call", async () => {
    await expect(saveProfile("alice", " ")).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reports read failures without exposing backend details", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: new Error("database internals"),
    });
    await expect(loadProfile("alice")).rejects.toThrow(
      "Unable to load your profile",
    );
  });
  it("reports write failures without exposing backend details", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: new Error("database internals"),
    });
    await expect(saveProfile("alice", "Alice")).rejects.toThrow(
      "Unable to save your profile",
    );
  });
});
