import { it, expect } from "vitest";
import { verifyWorkerRequest } from "../supabase/functions/notification-dispatcher/auth";
const secret = "local-test-worker-secret";
const now = 1793167200000;
async function signed(timestamp = String(now / 1000), body = "{}") {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${body}`),
    ),
  );
  const signature = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return { timestamp, signature, body };
}
const request = (v: { timestamp: string; signature: string; body: string }) =>
  new Request("https://test.invalid", {
    method: "POST",
    headers: {
      "X-Roam-Timestamp": v.timestamp,
      "X-Roam-Signature": v.signature,
    },
    body: v.body,
  });
it("accepts a signed current request without exposing the shared secret", async () => {
  const v = await signed();
  expect(await verifyWorkerRequest(request(v), secret, now)).toBe(true);
  expect(JSON.stringify(v)).not.toContain(secret);
});
it("rejects missing configuration, credentials and invalid signatures", async () => {
  expect(
    await verifyWorkerRequest(
      new Request("https://test.invalid"),
      undefined,
      now,
    ),
  ).toBe(false);
  expect(
    await verifyWorkerRequest(new Request("https://test.invalid"), secret, now),
  ).toBe(false);
  const v = await signed();
  expect(
    await verifyWorkerRequest(
      request({ ...v, signature: "0".repeat(64) }),
      secret,
      now,
    ),
  ).toBe(false);
  expect(
    await verifyWorkerRequest(request({ ...v, signature: "bad" }), secret, now),
  ).toBe(false);
});
it("rejects a modified body or timestamp", async () => {
  const v = await signed();
  expect(
    await verifyWorkerRequest(
      request({ ...v, body: '{"altered":true}' }),
      secret,
      now,
    ),
  ).toBe(false);
  expect(
    await verifyWorkerRequest(
      request({ ...v, timestamp: String(now / 1000 - 1) }),
      secret,
      now,
    ),
  ).toBe(false);
});
it("rejects expired and future signatures", async () => {
  expect(
    await verifyWorkerRequest(
      request(await signed(String(now / 1000 - 121))),
      secret,
      now,
    ),
  ).toBe(false);
  expect(
    await verifyWorkerRequest(
      request(await signed(String(now / 1000 + 31))),
      secret,
      now,
    ),
  ).toBe(false);
});
it("retains dedicated bearer authentication for trusted manual calls", async () => {
  expect(
    await verifyWorkerRequest(
      new Request("https://test.invalid", {
        headers: { Authorization: `Bearer ${secret}` },
      }),
      secret,
      now,
    ),
  ).toBe(true);
  expect(
    await verifyWorkerRequest(
      new Request("https://test.invalid", {
        headers: { Authorization: "Bearer invalid" },
      }),
      secret,
      now,
    ),
  ).toBe(false);
});
