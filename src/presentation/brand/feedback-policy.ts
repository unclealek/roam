export function isCriticalFeedbackRoute(path: string) {
  return (
    /^\/(auth|sign-in|welcome|edit-profile|privacy|notification-settings)(\/|$)/.test(
      path,
    ) ||
    /^\/group\/(create|join)/.test(path) ||
    /^\/group\/[^/]+\/(settings|members|invites)/.test(path) ||
    /^\/game\/secret_santa\//.test(path)
  );
}
export function suppressForegroundBanner(path: string) {
  return (
    isCriticalFeedbackRoute(path) ||
    /^\/(notifications|rewards|collectible|achievement)(\/|$)/.test(path)
  );
}
