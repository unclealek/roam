import * as Apple from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { requireSupabase } from "../supabase";
import { SignInError } from "./errors";

export async function signInWithApple() {
  if (Constants.appOwnership === "expo")
    throw new SignInError(
      "You’re running Expo Go, which uses Expo’s app identifier. Install a signed Roam build to sign in with com.moredata.roam.",
    );
  if (!(await Apple.isAvailableAsync()))
    throw new SignInError("Apple sign-in is not available on this device.");
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce,
  );
  let credential: Apple.AppleAuthenticationCredential;
  try {
    credential = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ERR_REQUEST_CANCELED"
    )
      return;
    throw new SignInError(
      "Apple sign-in could not open. Check that Sign in with Apple is enabled for this app and device.",
    );
  }
  if (!credential.identityToken)
    throw new SignInError(
      "Apple did not return an identity token. Please try again.",
    );
  const { error } = await requireSupabase().auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("audience"))
      throw new SignInError(
        "Apple’s app identifier does not match the allowed Supabase Client IDs. Use a signed Roam build configured as com.moredata.roam.",
      );
    if (message.includes("nonce"))
      throw new SignInError(
        "Apple’s security nonce could not be verified. Close sign-in and try again.",
      );
    throw new SignInError(
      "Supabase could not verify Apple sign-in. Check the Auth logs for this attempt; this does not necessarily mean the Client IDs are wrong.",
    );
  }
}
