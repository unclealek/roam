import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  signIn,
  finishSignIn,
  signInWithPassword,
} from "../src/platform/auth/sign-in";
const mock = vi.hoisted(() => ({
  nativeApple: vi.fn(),
  oauth: vi.fn(),
  password: vi.fn(),
  exchange: vi.fn(),
  browser: vi.fn(),
  platform: { OS: "ios" },
  constants: { appOwnership: null as string | null },
}));
vi.mock("../src/platform/auth/apple", () => ({
  signInWithApple: mock.nativeApple,
}));
vi.mock("expo-constants", () => ({ default: mock.constants }));
vi.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "roam://auth/callback",
}));
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: mock.browser,
}));
vi.mock("react-native", () => ({ Platform: mock.platform }));
vi.mock("../src/platform/supabase", () => ({
  requireSupabase: () => ({
    auth: {
      signInWithOAuth: mock.oauth,
      signInWithPassword: mock.password,
      exchangeCodeForSession: mock.exchange,
    },
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mock.platform.OS = "android";
  mock.constants.appOwnership = null;
  mock.oauth.mockResolvedValue({
    data: { url: "https://provider.example.test" },
    error: null,
  });
  mock.exchange.mockResolvedValue({ error: null });
});
describe("Apple and Google OAuth transport", () => {
  it("uses native Apple on iOS without starting browser OAuth", async () => {
    mock.platform.OS = "ios";
    await signIn("apple");
    expect(mock.nativeApple).toHaveBeenCalledOnce();
    expect(mock.oauth).not.toHaveBeenCalled();
    expect(mock.browser).not.toHaveBeenCalled();
  });
  it("explains the unsupported Expo Go callback before starting OAuth", async () => {
    mock.constants.appOwnership = "expo";
    await expect(signIn("google")).rejects.toThrow("installed Roam app");
    expect(mock.oauth).not.toHaveBeenCalled();
    expect(mock.browser).not.toHaveBeenCalled();
  });
  it.each(["apple", "google"] as const)(
    "starts %s with the registered PKCE redirect",
    async (provider) => {
      mock.browser.mockResolvedValue({
        type: "success",
        url: `roam://auth/callback?code=${provider}`,
      });
      await signIn(provider);
      expect(mock.oauth).toHaveBeenCalledWith({
        provider,
        options: {
          redirectTo: "roam://auth/callback",
          skipBrowserRedirect: true,
        },
      });
      expect(mock.exchange).toHaveBeenCalledWith(provider);
    },
  );
  it("allows cancellation without creating a session", async () => {
    mock.browser.mockResolvedValue({ type: "cancel" });
    await signIn("google");
    expect(mock.exchange).not.toHaveBeenCalled();
  });
  it("deduplicates route and browser callbacks", async () => {
    await Promise.all([
      finishSignIn("roam://auth/callback?code=dedup"),
      finishSignIn("roam://auth/callback?code=dedup"),
    ]);
    expect(mock.exchange).toHaveBeenCalledOnce();
  });
  it("reports provider failures", async () => {
    mock.oauth.mockResolvedValue({
      data: { url: null },
      error: new Error("provider"),
    });
    await expect(signIn("apple")).rejects.toThrow(
      "Roam couldn’t start sign-in",
    );
  });
  it("reports failed code exchange", async () => {
    mock.browser.mockResolvedValue({
      type: "success",
      url: "roam://auth/callback?code=expired",
    });
    mock.exchange.mockResolvedValue({ error: new Error("expired") });
    await expect(signIn("google")).rejects.toThrow(
      "Roam couldn’t finish signing you in",
    );
  });
  it("redirects the browser on web", async () => {
    mock.platform.OS = "web";
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    try {
      await signIn("google");
      expect(assign).toHaveBeenCalledWith("https://provider.example.test");
      expect(mock.browser).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("email sign-in", () => {
  it("trims the email and preserves the password", async () => {
    mock.password.mockResolvedValue({ error: null });
    await signInWithPassword("  review@example.invalid ", " password ");
    expect(mock.password).toHaveBeenCalledWith({
      email: "review@example.invalid",
      password: " password ",
    });
  });

  it("shows a generic message for rejected credentials", async () => {
    mock.password.mockResolvedValue({
      error: { code: "invalid_credentials", message: "internal details" },
    });
    await expect(
      signInWithPassword("review@example.invalid", "wrong"),
    ).rejects.toThrow("Email or password is incorrect.");
  });
});
