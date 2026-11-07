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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Profile from "../app/(tabs)/profile";
import EditProfile from "../app/(account)/edit-profile";
import Privacy from "../app/(account)/privacy";
import Home from "../app/(tabs)/index";
import Groups from "../app/(tabs)/groups";
import Rewards from "../app/(tabs)/rewards";
const mock = vi.hoisted(() => ({
  save: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  reload: vi.fn(),
  signIn: vi.fn(),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("expo-router", () => ({
  Redirect: () => null,
  useFocusEffect: () => undefined,
  router: { navigate: vi.fn() },
}));
vi.mock("../src/platform/auth/AuthProvider", () => ({
  useAuth: () => ({
    profile: { id: "alice", display_name: "Alice" },
    session: { user: { id: "alice" } },
    reloadProfile: mock.reload,
  }),
}));
vi.mock("../src/platform/supabase", () => ({
  requireSupabase: () => ({ rpc: mock.rpc, auth: { signOut: mock.signOut } }),
}));
vi.mock("../src/platform/profiles/service", () => ({ saveProfile: mock.save }));
vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn() }));
vi.mock("expo-crypto", () => ({ randomUUID: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  mock.save.mockResolvedValue({});
  mock.rpc.mockResolvedValue({ error: null });
  mock.signOut.mockResolvedValue({ error: null });
  mock.reload.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("Scope 01 screens", () => {
  it("saves a changed display name and reloads the profile", async () => {
    render(<EditProfile />);
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Profile saved.");
    expect(mock.save).toHaveBeenCalledWith("alice", "Alex");
    expect(mock.reload).toHaveBeenCalledOnce();
  });
  it("requires typed confirmation and deletes before local sign-out", async () => {
    render(<Privacy />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Permanently delete account" }),
    );
    expect(mock.rpc).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Permanently delete account" }),
    );
    await waitFor(() =>
      expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" }),
    );
    expect(mock.rpc).toHaveBeenCalledWith("delete_own_account");
  });
  it("keeps the account screen usable after deletion fails", async () => {
    mock.rpc.mockResolvedValue({ error: new Error("offline") });
    render(<Privacy />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Permanently delete account" }),
    );
    await screen.findByText(/Account could not be deleted/);
    expect(mock.signOut).not.toHaveBeenCalled();
  });
  it("signs out and surfaces network failures", async () => {
    mock.signOut.mockResolvedValue({ error: new Error("offline") });
    render(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByText(/Unable to sign out/);
  });
  it("renders the neutral Home and reserved tab empty states", () => {
    for (const Component of [Home, Groups, Rewards]) {
      const result = render(<Component />);
      expect(result.container.textContent).not.toMatch(/Santa|Christmas/);
      cleanup();
    }
  });
});

vi.mock("../src/presentation/rewards/RewardMotion", () => ({
  RewardMotion: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
