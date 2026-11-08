import * as Apple from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { requireSupabase } from "../supabase";
import { SignInError, signInErrorMessage } from "./errors";

export async function signInWithApple() {
  if (Constants.appOwnership === "expo")
    throw new SignInError("Open the installed Roam app to sign in with Apple.");
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
      "Roam couldn’t open Apple sign-in. Try again or choose another sign-in method.",
    );
  }
  if (!credential.identityToken)
    throw new SignInError(
      "Apple couldn’t finish signing you in. Please try again.",
    );
  const { error } = await requireSupabase().auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce,
  });
  if (error)
    throw new SignInError(
      signInErrorMessage(
        error,
        "Roam couldn’t sign you in with Apple. Try again or choose another sign-in method.",
      ),
    );
}
