import { setForegroundRouteSuppressed } from "../src/platform/notifications/presentation";
import {
  registerPush,
  observeNotifications,
  disablePushDevice,
} from "../src/platform/notifications/device.native";
import { vi, it, expect, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({
  permission: vi.fn(),
  request: vi.fn(),
  token: vi.fn(),
  register: vi.fn(),
  deactivate: vi.fn(),
  open: vi.fn(),
  refresh: vi.fn(),
  last: vi.fn(),
  responseListener: vi.fn(),
  tokenListener: vi.fn(),
  receivedListener: vi.fn(),
  clear: vi.fn(),
  remove: vi.fn(),
  channel: vi.fn(),
  os: "ios",
  state: "active",
  handler: null as null | {
    handleNotification: () => Promise<{
      shouldShowBanner: boolean;
      shouldShowList: boolean;
    }>;
  },
}));
vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return mock.state;
    },
  },
  Platform: {
    get OS() {
      return mock.os;
    },
  },
}));
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("expo-constants", () => ({
  default: { easConfig: { projectId: "project-id" } },
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: async () => "11111111-1111-4111-8111-111111111111",
  setItemAsync: vi.fn(),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "installation" }));
vi.mock("../src/platform/notifications/service", () => ({
  registerDevice: mock.register,
  deactivateDevice: mock.deactivate,
}));
vi.mock("expo-notifications", () => ({
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  AndroidImportance: { DEFAULT: 3 },
  setNotificationHandler: (handler: typeof mock.handler) => {
    mock.handler = handler;
  },
  getPermissionsAsync: mock.permission,
  requestPermissionsAsync: mock.request,
  getExpoPushTokenAsync: mock.token,
  setNotificationChannelAsync: mock.channel,
  getLastNotificationResponseAsync: mock.last,
  clearLastNotificationResponseAsync: mock.clear,
  addNotificationResponseReceivedListener: mock.responseListener,
  addPushTokenListener: mock.tokenListener,
  addNotificationReceivedListener: mock.receivedListener,
}));

beforeEach(() => {
  vi.clearAllMocks();
  setForegroundRouteSuppressed(false);
  mock.os = "ios";
  mock.state = "active";
  mock.permission.mockResolvedValue({ granted: false });
  mock.request.mockResolvedValue({ granted: false });
  mock.token.mockResolvedValue({ data: "ExpoPushToken[test]" });
  mock.last.mockResolvedValue(null);
  mock.responseListener.mockReturnValue({ remove: mock.remove });
  mock.tokenListener.mockReturnValue({ remove: mock.remove });
  mock.receivedListener.mockReturnValue({ remove: mock.remove });
});
it("does not prompt automatically or register a denied device", async () => {
  expect(await registerPush()).toBe(false);
  expect(mock.request).not.toHaveBeenCalled();
  expect(mock.register).not.toHaveBeenCalled();
  expect(mock.deactivate).toHaveBeenCalled();
});
it("registers only with OS permission and requests it only explicitly", async () => {
  mock.request.mockResolvedValue({ granted: true });
  expect(await registerPush(true)).toBe(true);
  expect(mock.token).toHaveBeenCalledWith({ projectId: "project-id" });
  expect(mock.register).toHaveBeenCalledWith(
    "ExpoPushToken[test]",
    "ios",
    "11111111-1111-4111-8111-111111111111",
  );
});
it("creates Android channel and supports provisional iOS permission", async () => {
  mock.os = "android";
  mock.permission.mockResolvedValue({ granted: true });
  await registerPush();
  expect(mock.channel).toHaveBeenCalledWith(
    "roam",
    expect.objectContaining({ name: "Roam updates" }),
  );
  mock.os = "ios";
  mock.state = "active";
  mock.permission.mockResolvedValue({ granted: false, ios: { status: 3 } });
  expect(await registerPush()).toBe(true);
});
it("handles cold/background taps, ignores malformed IDs, refreshes tokens and removes listeners", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  mock.last.mockResolvedValue({
    notification: {
      request: {
        identifier: "first",
        content: { data: { notification_id: id } },
      },
    },
  });
  const stop = observeNotifications(mock.open, mock.refresh);
  await Promise.resolve();
  expect(mock.open).toHaveBeenCalledWith(id);
  const listener = mock.responseListener.mock.calls[0][0];
  listener({
    notification: {
      request: {
        identifier: "second",
        content: { data: { notification_id: "https://evil.test" } },
      },
    },
  });
  expect(mock.open).toHaveBeenCalledTimes(1);
  mock.tokenListener.mock.calls[0][0]();
  expect(mock.refresh).toHaveBeenCalledOnce();
  stop();
  expect(mock.remove).toHaveBeenCalledTimes(2);
  await disablePushDevice();
  expect(mock.deactivate).toHaveBeenCalled();
});

it("reuses the native refresh token without fetching it again", async () => {
  mock.permission.mockResolvedValue({ granted: true });
  const token = { type: "ios" as const, data: "refreshed-native-token" };
  const stop = observeNotifications(mock.open, mock.refresh);
  mock.tokenListener.mock.calls[0][0](token);
  expect(mock.refresh).toHaveBeenCalledWith(token);
  await registerPush(false, token);
  expect(mock.token).toHaveBeenCalledWith({
    projectId: "project-id",
    devicePushToken: token,
  });
  stop();
});

it("preserves notification-list delivery while suppressing foreground banners on critical UI", async () => {
  expect((await mock.handler!.handleNotification()).shouldShowBanner).toBe(
    false,
  );
  setForegroundRouteSuppressed(true);
  const result = await mock.handler!.handleNotification();
  expect(result.shouldShowBanner).toBe(false);
  expect(result.shouldShowList).toBe(true);
  mock.state = "background";
  expect((await mock.handler!.handleNotification()).shouldShowBanner).toBe(
    true,
  );
});

it("delivers each foreground notice once through the existing observer", () => {
  const receive = vi.fn();
  const stop = observeNotifications(mock.open, mock.refresh, receive);
  const callback = mock.receivedListener.mock.calls[0][0];
  const notification = {
    request: {
      identifier: "event",
      content: {
        data: { notification_id: "11111111-1111-4111-8111-111111111111" },
      },
    },
  };
  callback(notification);
  callback(notification);
  expect(receive).toHaveBeenCalledTimes(1);
  stop();
});
