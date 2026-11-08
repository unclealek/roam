import { beforeEach, expect, it, vi } from "vitest";
import { signInWithApple } from "../src/platform/auth/apple";
const mock = vi.hoisted(() => ({
  available: vi.fn(),
  apple: vi.fn(),
  token: vi.fn(),
  constants: { appOwnership: null as string | null },
}));
vi.mock("expo-constants", () => ({ default: mock.constants }));
vi.mock("expo-apple-authentication", () => ({
  isAvailableAsync: mock.available,
  signInAsync: mock.apple,
  AppleAuthenticationScope: { EMAIL: 0 },
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "raw-nonce",
  digestStringAsync: vi.fn(async () => "hashed-nonce"),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));
vi.mock("../src/platform/supabase", () => ({
  requireSupabase: () => ({ auth: { signInWithIdToken: mock.token } }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mock.constants.appOwnership = null;
  mock.available.mockResolvedValue(true);
  mock.apple.mockResolvedValue({ identityToken: "apple-token" });
  mock.token.mockResolvedValue({ error: null });
});
it("passes a hashed nonce to Apple and the original nonce to Supabase", async () => {
  await signInWithApple();
  expect(mock.apple).toHaveBeenCalledWith({
    requestedScopes: [0],
    nonce: "hashed-nonce",
  });
  expect(mock.token).toHaveBeenCalledWith({
    provider: "apple",
    token: "apple-token",
    nonce: "raw-nonce",
  });
});
it("does not exchange a token when canceled", async () => {
  mock.apple.mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });
  await signInWithApple();
  expect(mock.token).not.toHaveBeenCalled();
});
it("rejects missing tokens", async () => {
  mock.apple.mockResolvedValue({ identityToken: null });
  await expect(signInWithApple()).rejects.toThrow(
    "Apple couldn’t finish signing you in",
  );
  expect(mock.token).not.toHaveBeenCalled();
});
it("handles unavailable devices", async () => {
  mock.available.mockResolvedValue(false);
  await expect(signInWithApple()).rejects.toThrow("not available");
  expect(mock.apple).not.toHaveBeenCalled();
});
it("hides backend errors", async () => {
  mock.token.mockResolvedValue({ error: new Error("secret details") });
  await expect(signInWithApple()).rejects.toThrow(
    "Roam couldn’t sign you in with Apple",
  );
});
it("reports audience errors without exposing the backend response", async () => {
  mock.token.mockResolvedValue({
    error: {
      message: "Unacceptable audience in id_token: private-value",
      code: "bad_jwt",
      status: 400,
    },
  });
  await expect(signInWithApple()).rejects.toThrow(
    "Roam couldn’t sign you in with Apple",
  );
});
it("asks the player to restart an unverified Apple sign-in", async () => {
  mock.token.mockResolvedValue({
    error: { message: "Nonces mismatch", code: "validation_failed" },
  });
  await expect(signInWithApple()).rejects.toThrow(
    "Roam couldn’t sign you in with Apple",
  );
});
it("explains Expo Go’s identity before requesting Apple credentials", async () => {
  mock.constants.appOwnership = "expo";
  await expect(signInWithApple()).rejects.toThrow("installed Roam app");
  expect(mock.apple).not.toHaveBeenCalled();
  expect(mock.token).not.toHaveBeenCalled();
});
