import { it, expect, vi } from "vitest";
import {
  dispatch,
  type Worker,
} from "../supabase/functions/notification-dispatcher/dispatcher";
import { notificationRoute } from "../src/platform/notifications/routes";
const claim = { id: "delivery", lease_id: "lease" };
function setup() {
  const worker = vi.fn(async (action: string) =>
    action === "claim"
      ? [claim]
      : action === "receipts"
        ? []
        : action === "begin_send"
          ? {
              to: "ExpoPushToken[test]",
              title: "New activity",
              body: "A challenge is waiting",
              data: { notification_id: "owned-id" },
            }
          : true,
  );
  return worker;
}
it("sends only server-prepared payloads and records provider acceptance", async () => {
  const worker = setup();
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ data: { status: "ok", id: "ticket" } }));
  await dispatch(worker as Worker, fetcher, "server-access-token");
  expect(worker).toHaveBeenCalledWith("sent", {
    ...claim,
    ticket: "ticket",
    error: undefined,
  });
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.data).toEqual({ notification_id: "owned-id" });
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
    "Bearer server-access-token",
  );
});
it("records explicit transient rejection for backoff and ambiguous timeouts for reconciliation", async () => {
  for (const status of [429, 503, 401]) {
    const worker = setup();
    await dispatch(
      worker as Worker,
      vi.fn().mockResolvedValue(new Response("", { status })),
    );
    expect(worker).toHaveBeenCalledWith("sent", {
      ...claim,
      error: `HTTP_${status}`,
    });
  }
  const worker = setup();
  await dispatch(
    worker as Worker,
    vi.fn().mockRejectedValue(new Error("timeout")),
  );
  expect(worker).toHaveBeenCalledWith("sent", { ...claim, error: "ambiguous" });
});
it("polls receipts independently and distinguishes missing, success and invalid tokens", async () => {
  const receipts = [
    { ...claim, ticket: "a" },
    { id: "2", lease_id: "b", ticket: "b" },
    { id: "3", lease_id: "c", ticket: "c" },
  ];
  const worker = vi.fn(async (action: string) =>
    action === "receipts" ? receipts : action === "claim" ? [] : true,
  );
  await dispatch(
    worker as Worker,
    vi.fn().mockResolvedValue(
      Response.json({
        data: {
          a: { status: "ok" },
          b: { status: "error", details: { error: "DeviceNotRegistered" } },
        },
      }),
    ),
  );
  expect(worker).toHaveBeenCalledWith("receipt", {
    ...receipts[0],
    status: "ok",
    error: undefined,
  });
  expect(worker).toHaveBeenCalledWith("receipt", {
    ...receipts[1],
    status: "error",
    error: "DeviceNotRegistered",
  });
  expect(worker).toHaveBeenCalledWith("receipt", {
    ...receipts[2],
    status: "missing",
    error: undefined,
  });
});
it("rejects arbitrary deep links and allows only protected known destinations", () => {
  for (const bad of [
    "https://evil.test",
    "roam://session/x",
    "/profile",
    "/session/../../../sign-in",
    "/session/11111111-1111-4111-8111-111111111111?admin=true",
    null,
  ])
    expect(notificationRoute(bad)).toBeNull();
  expect(
    notificationRoute("/session/11111111-1111-4111-8111-111111111111"),
  ).toBe("/session/11111111-1111-4111-8111-111111111111");
  expect(notificationRoute("/notifications")).toBe("/notifications");
});
