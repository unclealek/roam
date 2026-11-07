import { describe, it, expect, vi } from "vitest";
import { normalizeDisplayName } from "../src/platform/profiles/validation";
import {
  callbackCode,
  completeOAuth,
  deleteAccount,
} from "../src/platform/auth/operations";

describe("display names", () => {
  it("trims names and preserves international characters", () =>
    expect(normalizeDisplayName("  Väinö 🎲  ")).toBe("Väinö 🎲"));
  it.each(["", "   ", "a".repeat(51), "hello\nworld"])(
    "rejects invalid name %j",
    (value) => expect(() => normalizeDisplayName(value)).toThrow(),
  );
  it("accepts boundary lengths", () => {
    expect(normalizeDisplayName("a")).toBe("a");
    expect(normalizeDisplayName("a".repeat(50))).toHaveLength(50);
  });
});

describe("OAuth callback", () => {
  it("extracts only a code from the expected callback", () =>
    expect(
      callbackCode("roam://auth/callback?code=abc", "roam://auth/callback"),
    ).toBe("abc"));
  it.each([
    "https://evil.test?code=abc",
    "roam://auth/other?code=abc",
    "roam://auth/callback",
    "roam://auth/callback?error=access_denied",
    "invalid",
  ])("rejects unexpected or unsuccessful callbacks %s", (url) =>
    expect(() => callbackCode(url, "roam://auth/callback")).toThrow(),
  );
  it("exchanges PKCE code and propagates errors", async () => {
    const exchange = vi.fn().mockResolvedValue({ error: null });
    await completeOAuth(
      "roam://auth/callback?code=abc",
      "roam://auth/callback",
      exchange,
    );
    expect(exchange).toHaveBeenCalledWith("abc");
    exchange.mockResolvedValue({ error: new Error("expired") });
    await expect(
      completeOAuth(
        "roam://auth/callback?code=abc",
        "roam://auth/callback",
        exchange,
      ),
    ).rejects.toThrow();
  });
});

describe("account deletion", () => {
  it("clears the local session only after server deletion succeeds", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const clear = vi.fn().mockResolvedValue({ error: null });
    await deleteAccount(remove, clear);
    expect(remove).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
  });
  it("retains session on server failure so deletion can be retried", async () => {
    const clear = vi.fn();
    await expect(
      deleteAccount(async () => ({ error: new Error("offline") }), clear),
    ).rejects.toThrow();
    expect(clear).not.toHaveBeenCalled();
  });
  it("reports local cleanup errors after deletion", async () => {
    await expect(
      deleteAccount(
        async () => ({ error: null }),
        async () => ({ error: new Error("storage") }),
      ),
    ).rejects.toThrow();
  });
});

it("explains group ownership requirements before account deletion", async () => {
  const clear = vi.fn();
  await expect(
    deleteAccount(
      async () => ({ error: { message: "GROUP_OWNERSHIP_REQUIRED" } }),
      clear,
    ),
  ).rejects.toThrow(/Transfer ownership/);
  expect(clear).not.toHaveBeenCalled();
});
