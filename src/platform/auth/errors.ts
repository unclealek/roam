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
    ? "Sign-in requires an installed Roam development build. Expo Go cannot complete this app’s secure sign-in callback."
    : null;
}

export function signInErrorMessage(error: unknown) {
  return error instanceof SignInError
    ? error.message
    : "Sign-in could not be completed. Please try again. If it continues, check the provider setup and the app’s callback configuration.";
}
