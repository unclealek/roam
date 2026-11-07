import { describe, expect, it } from "vitest";
import {
  SignInError,
  signInErrorMessage,
  nativeSignInRequirement,
} from "../src/platform/auth/errors";
describe("actionable sign-in errors", () => {
  it("identifies Expo Go without blocking installed development builds", () => {
    expect(nativeSignInRequirement("ios", "expo")).toMatch(/development build/);
    expect(nativeSignInRequirement("android", "expo")).toMatch(
      /development build/,
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
