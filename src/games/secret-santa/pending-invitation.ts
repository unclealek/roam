// Only a validated, fixed application route may survive the sign-in redirect.
// In-memory only; no invitation secrets are written to logs or general storage.
let pending: string | null = null;
export function rememberSantaInvitation(code: unknown) {
  if (typeof code === "string" && /^[a-f0-9]{64}$/i.test(code))
    pending = `/game/secret_santa/join?code=${code.toLowerCase()}`;
}
export function pendingSantaInvitation() {
  return pending;
}
export function clearSantaInvitation() {
  pending = null;
}
