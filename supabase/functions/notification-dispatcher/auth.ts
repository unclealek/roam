/** Cron sends a short-lived signature; its queued headers never contain this key. */
export async function verifyWorkerRequest(
  request: Request,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!secret) return false;
  // Retained for trusted manual invocation; Cron never uses this header.
  if (request.headers.get("Authorization") === `Bearer ${secret}`) return true;
  const timestamp = request.headers.get("X-Roam-Timestamp") ?? "";
  const signature = request.headers.get("X-Roam-Signature") ?? "";
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature))
    return false;
  const age = now / 1000 - Number(timestamp);
  if (age > 120 || age < -30) return false;
  const body = await request.clone().text();
  if (body.length > 8192) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.match(/../g)!, (s) =>
    parseInt(s, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
}
