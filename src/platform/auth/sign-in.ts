import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  nativeSignInRequirement,
  SignInError,
  signInErrorMessage,
} from "./errors";
import { requireSupabase } from "../supabase";
import { completeOAuth } from "./operations";
import { signInWithApple } from "./apple";
WebBrowser.maybeCompleteAuthSession();
export const redirectUri = () =>
  makeRedirectUri({ scheme: "roam", path: "auth/callback" });
let pending: { url: string; promise: Promise<void> } | null = null;
export function finishSignIn(url: string) {
  if (pending?.url === url) return pending.promise;
  const promise = completeOAuth(url, redirectUri(), (code) =>
    requireSupabase().auth.exchangeCodeForSession(code),
  );
  pending = { url, promise };
  return promise;
}
export async function signIn(provider: "apple" | "google") {
  if (provider === "apple" && Platform.OS === "ios") return signInWithApple();
  const requirement = nativeSignInRequirement(
    Platform.OS,
    Constants.appOwnership,
  );
  if (requirement) throw new SignInError(requirement);
  const client = requireSupabase();
  const redirectTo = redirectUri();
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url)
    throw new SignInError(
      signInErrorMessage(
        error,
        "Roam couldn’t start sign-in. Try again or choose another sign-in method.",
      ),
    );
  if (Platform.OS === "web") {
    window.location.assign(data.url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "success") await finishSignIn(result.url);
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error?.code === "invalid_credentials")
    throw new SignInError("Email or password is incorrect.");
  if (error) throw new SignInError(signInErrorMessage(error));
}
