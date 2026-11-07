// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ProfileScreen,
  EditProfile,
} from "../src/presentation/profile/ProfileScreens";
import { getRewardDashboard } from "../src/platform/rewards/service";
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  navigate: vi.fn(),
  save: vi.fn(),
  resource: vi.fn(),
  reload: vi.fn(),
}));
vi.mock("expo-router", () => ({
  router: { push: mocks.push, navigate: mocks.navigate },
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("../src/platform/auth/AuthProvider", () => ({
  useAuth: () => ({
    session: { user: { id: "alice" } },
    profile: { display_name: "Alice" },
    reloadProfile: mocks.reload,
  }),
}));
vi.mock("../src/platform/profiles/service", () => ({
  saveProfile: mocks.save,
}));
vi.mock("../src/platform/supabase", () => ({ requireSupabase: vi.fn() }));
vi.mock("../src/platform/notifications/device", () => ({
  disablePushDevice: vi.fn(),
}));
vi.mock("../src/platform/sessions/useAccountResource", () => ({
  useAccountResource: mocks.resource,
}));
vi.mock("../src/platform/rewards/service", () => ({
  getRewardDashboard: vi.fn(),
}));
const data = {
  progress: { level: 4, total_xp: 720, progress: 0.4, xp_to_next_level: 230 },
  achievements: [{ earned_id: "earned" }, { earned_id: null }],
  collectibles: [{ owned_id: "owned" }, { owned_id: null }],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resource.mockImplementation((load) => ({
    data: load === getRewardDashboard ? data : [{ id: "group" }],
    loading: false,
    refresh: vi.fn(),
  }));
});
afterEach(cleanup);
it("shows actual progression and owned rewards without exposing unearned collection details", () => {
  render(<ProfileScreen />);
  expect(screen.getByText("720 total XP")).toBeTruthy();
  expect(screen.getByText("230 XP to level 5")).toBeTruthy();
  expect(screen.getAllByText("1")).toHaveLength(3);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
    "0.4",
  );
  fireEvent.click(screen.getByRole("button", { name: "View rewards" }));
  expect(mocks.navigate).toHaveBeenCalledWith("/rewards");
  fireEvent.click(screen.getByRole("button", { name: "Edit Profile" }));
  expect(mocks.push).toHaveBeenCalledWith("/edit-profile");
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  expect(mocks.push).toHaveBeenCalledWith("/notification-settings");
});
it("does not turn a failed progression request into a zero balance", () => {
  mocks.resource.mockReturnValue({ error: "Offline", refresh: vi.fn() });
  render(<ProfileScreen />);
  expect(screen.getAllByText("Offline")).toHaveLength(2);
  expect(screen.queryByText(/total XP/)).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
});
it("validates profile names before writing and allows retry after a save failure", async () => {
  render(<EditProfile />);
  expect(
    screen
      .getByRole("button", { name: "Save changes" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getAllByRole("button", { name: "Back to Profile" }),
  ).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: " " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.save.mockRejectedValueOnce(
    new Error("Unable to save your profile. Please retry."),
  );
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Alex" },
  });
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Unable to save your profile. Please retry.");
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Save changes" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  mocks.save.mockResolvedValue({});
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Profile saved.");
  expect(mocks.save).toHaveBeenLastCalledWith("alice", "Alex");
});
