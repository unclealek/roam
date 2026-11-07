import { describe, expect, it } from "vitest";
import { createSessionStorage } from "../src/platform/auth/storage";
function fixture() {
  const map = new Map<string, string>();
  const store = {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: async (key: string) => {
      map.delete(key);
    },
  };
  return { map, store, storage: createSessionStorage(store) };
}
describe("native secure session persistence", () => {
  it("round-trips large provider sessions using bounded keychain values", async () => {
    const { map, storage } = fixture();
    const session = "a" + "🎲".repeat(6000);
    await storage.setItem("session", session);
    expect(await storage.getItem("session")).toBe(session);
    expect([...map.values()].every((value) => value.isWellFormed())).toBe(true);
    expect(
      [...map.values()].every(
        (value) => Buffer.byteLength(value, "utf8") <= 2048,
      ),
    ).toBe(true);
  });
  it("replaces a session and removes the previous chunks", async () => {
    const { map, storage } = fixture();
    await storage.setItem("session", "a".repeat(3000));
    await storage.setItem("session", "new");
    expect(await storage.getItem("session")).toBe("new");
    expect(map.size).toBe(2);
  });
  it("removes both the pointer and its encrypted chunks on sign-out", async () => {
    const { map, storage } = fixture();
    await storage.setItem("session", "token");
    await storage.removeItem("session");
    expect(map.size).toBe(0);
    expect(await storage.getItem("session")).toBeNull();
  });
  it("keeps the prior session when writing a replacement fails", async () => {
    const { store, storage } = fixture();
    await storage.setItem("session", "old");
    const original = store.setItem;
    store.setItem = async (key, value) => {
      if (value === "new") throw new Error("keychain unavailable");
      await original(key, value);
    };
    await expect(storage.setItem("session", "new")).rejects.toThrow();
    expect(await storage.getItem("session")).toBe("old");
  });
  it("rejects an incomplete session instead of returning a truncated token", async () => {
    const { map, storage } = fixture();
    await storage.setItem("session", "token");
    map.delete([...map.keys()].find((key) => key !== "session")!);
    await expect(storage.getItem("session")).rejects.toThrow("incomplete");
  });
});
