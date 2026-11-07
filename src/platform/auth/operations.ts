import { SignInError } from "./errors";
type Outcome = { error: unknown };
export function callbackCode(url: string, redirect: string): string {
  const actual = new URL(url);
  const expected = new URL(redirect);
  if (
    actual.protocol !== expected.protocol ||
    actual.host !== expected.host ||
    actual.pathname !== expected.pathname
  ) {
    throw new SignInError(
      "Unexpected sign-in callback. Check the app’s callback configuration.",
    );
  }
  const code = actual.searchParams.get("code");
  if (actual.searchParams.has("error") || !code)
    throw new SignInError("Sign-in was not completed. Please try again.");
  return code;
}
export async function completeOAuth(
  url: string,
  redirect: string,
  exchange: (code: string) => Promise<Outcome>,
) {
  const result = await exchange(callbackCode(url, redirect));
  if (result.error)
    throw new SignInError("Unable to finish sign-in. Please try again.");
}
export async function deleteAccount(
  remove: () => PromiseLike<Outcome>,
  clear: () => PromiseLike<Outcome>,
) {
  const result = await remove();
  if (
    result.error &&
    typeof result.error === "object" &&
    "message" in result.error &&
    result.error.message === "GROUP_OWNERSHIP_REQUIRED"
  )
    throw new Error(
      "Transfer ownership, appoint a vice owner, or delete eligible groups you own before deleting your account.",
    );
  if (result.error)
    throw new Error(
      "Account could not be deleted. Check your connection and try again.",
    );
  const cleanup = await clear();
  if (cleanup.error)
    throw new Error(
      "Account deleted. Close and reopen the app to clear this session.",
    );
}
