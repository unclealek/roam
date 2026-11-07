// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { vi, it, expect, afterEach } from "vitest";
import {
  NotificationCenter,
  NotificationSettings,
} from "../src/presentation/notifications/NotificationScreens";
const mock = vi.hoisted(() => ({
  os: "web",
  register: vi.fn(),
  disable: vi.fn(),
  push: vi.fn(),
  mark: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
  data: null as unknown,
}));
vi.mock("react-native", async (original) => {
  const actual = await original<typeof import("react-native")>();
  return {
    ...actual,
    Platform: {
      ...actual.Platform,
      get OS() {
        return mock.os;
      },
    },
  };
});
vi.mock("../src/platform/notifications/device", () => ({
  notificationPermission: vi.fn().mockResolvedValue(false),
  registerPush: mock.register,
  disablePushDevice: mock.disable,
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("expo-router", () => ({
  router: { push: mock.push },
  useFocusEffect: () => {},
}));
vi.mock("../src/platform/auth/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: "alice" } } }),
}));
vi.mock("../src/platform/sessions/useAccountResource", () => ({
  useAccountResource: () => ({
    data: mock.data,
    loading: false,
    error: null,
    refresh: mock.refresh,
  }),
}));
vi.mock("../src/platform/notifications/service", () => ({
  getPreferences: vi.fn(),
  listNotifications: vi.fn(),
  markNotification: mock.mark,
  savePreferences: mock.save,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mock.os = "web";
});
it("renders empty notifications and unread count", () => {
  mock.data = { unread_count: 0, items: [] };
  render(<NotificationCenter />);
  expect(screen.getByText("0 unread")).toBeTruthy();
  expect(screen.getByText("You’re all caught up")).toBeTruthy();
});
it("marks a notification before navigating and supports unread state", async () => {
  mock.data = {
    unread_count: 1,
    items: [
      {
        id: "one",
        title: "New activity",
        body: "Waiting for you",
        route: "/session/11111111-1111-4111-8111-111111111111",
        read_at: null,
      },
    ],
  };
  render(<NotificationCenter />);
  fireEvent.click(screen.getByRole("button", { name: "Open notification" }));
  await waitFor(() =>
    expect(mock.push).toHaveBeenCalledWith(
      "/session/11111111-1111-4111-8111-111111111111",
    ),
  );
  expect(mock.mark).toHaveBeenCalledWith("one");
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Mark as read",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  await waitFor(() => expect(mock.mark).toHaveBeenCalledWith("one", true));
});
it("saves reminder settings without claiming device permission", async () => {
  mock.data = {
    user_id: "alice",
    push_enabled: false,
    group_updates_enabled: true,
    game_updates_enabled: true,
    your_turn_enabled: true,
    secret_messages_enabled: true,
    reminders_enabled: false,
    rewards_enabled: false,
    preferred_reminder_time: "18:00",
    quiet_hours_enabled: true,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    timezone: "UTC",
    updated_at: "",
  };
  mock.save.mockResolvedValue(mock.data);
  render(<NotificationSettings />);
  fireEvent.change(screen.getByLabelText("Timezone (e.g. Europe/Helsinki)"), {
    target: { value: "Europe/Helsinki" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  await screen.findByText("Notifications saved.");
  expect(mock.save).toHaveBeenCalledWith(
    expect.objectContaining({
      push_enabled: false,
      timezone: "Europe/Helsinki",
    }),
  );
});

for (const initialPush of [true, false]) {
  it(`handles denied native permission with existing push ${initialPush}`, async () => {
    mock.os = "ios";
    mock.data = {
      user_id: "alice",
      push_enabled: initialPush,
      group_updates_enabled: true,
      game_updates_enabled: true,
      your_turn_enabled: true,
      secret_messages_enabled: true,
      reminders_enabled: false,
      rewards_enabled: false,
      preferred_reminder_time: "18:00",
      quiet_hours_enabled: true,
      quiet_hours_start: "22:00",
      quiet_hours_end: "08:00",
      timezone: "UTC",
      updated_at: "",
    };
    mock.register.mockResolvedValue(false);
    mock.save.mockImplementation(async (patch) => ({
      ...(mock.data as object),
      ...patch,
    }));
    render(<NotificationSettings />);
    if (!initialPush)
      fireEvent.click(
        screen.getByRole("switch", { name: "Push notifications enabled" }),
      );
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() =>
      expect(mock.save).toHaveBeenCalledWith(
        expect.objectContaining({ push_enabled: initialPush }),
      ),
    );
    expect(mock.register).toHaveBeenCalledWith(!initialPush);
    await screen.findByText(
      initialPush
        ? "Push remains enabled for your other devices. Notification permission is off on this device."
        : "Push permission is off or unavailable on this device. Your in-app notifications remain available.",
    );
  });
}
