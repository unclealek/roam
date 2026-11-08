import { describe, expect, it } from "vitest";
import {
  SignInError,
  sessionRestoreErrorMessage,
  signInErrorMessage,
  nativeSignInRequirement,
} from "../src/platform/auth/errors";
describe("actionable sign-in errors", () => {
  it("identifies Expo Go without blocking installed development builds", () => {
    expect(nativeSignInRequirement("ios", "expo")).toMatch(
      /installed Roam app/,
    );
    expect(nativeSignInRequirement("android", "expo")).toMatch(
      /installed Roam app/,
    );
    expect(nativeSignInRequirement("ios", null)).toBeNull();
    expect(nativeSignInRequirement("web", "expo")).toBeNull();
  });
  it("shows only explicitly safe auth errors, never raw server responses", () => {
    expect(signInErrorMessage(new SignInError("Install Roam first."))).toBe(
      "Install Roam first.",
    );
    expect(
      signInErrorMessage(new Error("private server response")),
    ).not.toContain("private server response");
  });
});

it("gives connection guidance without showing the auth response", () => {
  const error = { name: "AuthRetryableFetchError", message: "private details" };
  expect(sessionRestoreErrorMessage(error)).toBe(
    "Roam couldn’t reconnect to your session. Check your internet connection and try again.",
  );
  expect(signInErrorMessage(error)).toBe(
    "Roam couldn’t connect. Check your internet connection and try signing in again.",
  );
});

it("gives device recovery guidance for a Keychain read error", () => {
  expect(sessionRestoreErrorMessage({ code: "ERR_KEY_CHAIN" })).toBe(
    "Roam couldn’t access your saved sign-in on this device. Close and reopen Roam. If it keeps happening, contact Roam support.",
  );
});
