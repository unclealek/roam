import { vi, it, expect, beforeEach } from "vitest";
import {
  getPreferences,
  savePreferences,
  listNotifications,
  markNotification,
  registerDevice,
  deactivateDevice,
  getNotification,
} from "../src/platform/notifications/service";
import { getAvailableActivities } from "../src/platform/activities/service";
import { activityService } from "../supabase/functions/notification-dispatcher/activities";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}));
vi.mock("../src/platform/supabase", () => ({
  requireSupabase: () => ({ rpc: mock.rpc, from: mock.from }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.from.mockReturnValue({ select: mock.select });
  mock.select.mockReturnValue({ eq: mock.eq });
  mock.eq.mockReturnValue({
    eq: mock.eq,
    maybeSingle: mock.single,
    data: [],
    error: null,
  });
  mock.single.mockResolvedValue({ data: null, error: null });
});
it("routes every preference, device, pagination and read mutation through authenticated RPCs", async () => {
  await getPreferences();
  await savePreferences({ reminders_enabled: true });
  await listNotifications();
  await listNotifications({ id: "id", created_at: "utc" });
  await markNotification("owned", false);
  await registerDevice("token", "ios", "install");
  await deactivateDevice("install");
  expect(mock.rpc).toHaveBeenCalledWith("notification_account", {
    p_action: "list",
    p_data: { before_id: "id", before_created_at: "utc" },
  });
  expect(mock.rpc).toHaveBeenCalledWith("notification_account", {
    p_action: "read",
    p_data: { id: "owned", read: false },
  });
  expect(mock.rpc).toHaveBeenCalledWith("notification_account", {
    p_action: "register_device",
    p_data: {
      expo_push_token: "token",
      platform: "ios",
      device_identifier: "install",
    },
  });
  mock.rpc.mockResolvedValue({ error: { message: "private detail" } });
  await expect(getPreferences()).rejects.toThrow(
    "Unable to update notifications",
  );
});
it("loads only owned notification records and server-authorized available activities", async () => {
  expect(await getNotification("owned")).toBeNull();
  expect(mock.eq).toHaveBeenCalledWith("id", "owned");
  expect(await getAvailableActivities("session")).toEqual([]);
  expect(mock.eq).toHaveBeenCalledWith("status", "available");
  mock.single.mockResolvedValue({ error: true });
  await expect(getNotification("id")).rejects.toThrow();
  mock.eq.mockReturnValue({ eq: mock.eq, error: true });
  await expect(getAvailableActivities("id")).rejects.toThrow();
});
it("exposes typed trusted game operations and uses database time for triggered replays", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: "activity", error: null });
  const api = activityService(rpc);
  const input = {
    sessionId: "session",
    activityType: "challenge",
    idempotencyKey: "trusted-event",
  };
  expect(
    await api.scheduleActivity({ ...input, unlockAt: "2026-11-01T12:00:00Z" }),
  ).toBe("activity");
  await api.createTriggeredActivity(input);
  expect(rpc).toHaveBeenLastCalledWith(
    "schedule_activity",
    expect.objectContaining({ p_unlock: null, p_key: "trusted-event" }),
  );
  await api.completeActivity("activity");
  expect(rpc).toHaveBeenLastCalledWith("transition_activity", {
    p_id: "activity",
    p_status: "completed",
  });
  await api.cancelActivity("activity");
  expect(rpc).toHaveBeenLastCalledWith("transition_activity", {
    p_id: "activity",
    p_status: "cancelled",
  });
  rpc.mockResolvedValue({ data: null, error: true });
  await expect(api.cancelActivity("activity")).rejects.toThrow();
});
