export class SignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignInError";
  }
}

export function nativeSignInRequirement(
  platform: string,
  ownership: string | null,
) {
  return platform !== "web" && ownership === "expo"
    ? "Open the installed Roam app to sign in."
    : null;
}

function isConnectionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AuthRetryableFetchError"
  );
}

export function sessionRestoreErrorMessage(error: unknown) {
  if (isConnectionError(error))
    return "Roam couldn’t reconnect to your session. Check your internet connection and try again.";

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_KEY_CHAIN"
  )
    return "Roam couldn’t access your saved sign-in on this device. Close and reopen Roam. If it keeps happening, contact Roam support.";

  return "Roam couldn’t reopen your saved session. Tap Try again. If it keeps happening, contact Roam support.";
}

export function signInErrorMessage(
  error: unknown,
  fallback = "Roam couldn’t sign you in. Please try again.",
) {
  if (error instanceof SignInError) return error.message;
  if (isConnectionError(error))
    return "Roam couldn’t connect. Check your internet connection and try signing in again.";
  return fallback;
}
