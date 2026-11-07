// @vitest-environment jsdom
import React from "react";
import { Share } from "react-native";
import "./fixtures/brand-native-mocks";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  MyGroups,
  CreateGroup,
  JoinGroup,
  GroupRoute,
} from "../src/presentation/groups/GroupScreens";
vi.mock("../src/presentation/groups/GroupLobbies", () => ({
  SantaGroupLobbies: () => null,
}));
const id = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  preview: vi.fn(),
  join: vi.fn(),
  invite: vi.fn(),
  revoke: vi.fn(),
  remove: vi.fn(),
  transfer: vi.fn(),
  setVice: vi.fn(),
  update: vi.fn(),
  leave: vi.fn(),
  delete: vi.fn(),
  resource: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  copy: vi.fn(),
  user: "11111111-1111-4111-8111-111111111111",
}));
vi.mock("expo-router", () => ({
  router: { replace: mocks.replace, push: mocks.push },
  useLocalSearchParams: () => ({
    groupId: "11111111-1111-4111-8111-111111111111",
  }),
}));
vi.mock("expo-clipboard", () => ({ setStringAsync: mocks.copy }));
vi.mock("expo-crypto", () => ({ randomUUID: () => id }));
vi.mock("../src/platform/supabase", () => ({ requireSupabase: vi.fn() }));
vi.mock("../src/platform/auth/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: mocks.user } } }),
}));
vi.mock("../src/platform/sessions/useAccountResource", () => ({
  useAccountResource: mocks.resource,
}));
vi.mock("../src/platform/groups/service", () => ({ groupService: mocks }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
const group = {
  id,
  name: "Office Friends",
  description: "Every game together",
  icon_key: "coffee",
  owner_id: id,
  member_count: 2,
  created_at: "2026-10-27",
  updated_at: "2026-10-27",
  members: [
    { user_id: id, display_name: "Alice", role: "owner" },
    {
      user_id: "22222222-2222-4222-8222-222222222222",
      display_name: "Bob",
      role: "member",
    },
  ],
  sessions: [],
  invites: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = id;
  mocks.resource.mockReturnValue({
    data: group,
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
});
afterEach(cleanup);
describe("groups screens", () => {
  it("shows loading, retry, empty and group list states", () => {
    for (const state of [
      { loading: true },
      { error: "Offline", refresh: vi.fn() },
      { data: [] },
      { data: [group] },
    ]) {
      mocks.resource.mockReturnValue(state);
      const view = render(<MyGroups />);
      expect(view.container.textContent).toMatch(
        /Loading|Offline|Bring your people together.|Office Friends/,
      );
      cleanup();
    }
  });
  it("creates with validated service input and opens details", async () => {
    mocks.create.mockResolvedValue(group);
    render(<CreateGroup />);
    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "Office Friends" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Group" }));
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(`/group/${id}`),
    );
    expect(mocks.create).toHaveBeenCalledWith({
      name: "Office Friends",
      description: "",
      icon_key: null,
    });
  });
  it("requires preview and confirmation before joining", async () => {
    mocks.preview.mockResolvedValue(group);
    mocks.join.mockResolvedValue(group);
    render(<JoinGroup />);
    fireEvent.change(screen.getByLabelText("Invite code"), {
      target: { value: "a".repeat(64) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find group" }));
    await screen.findByText("Invitation Preview");
    expect(mocks.join).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Join group" }));
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(`/group/${id}?joined=1`),
    );
  });
  it("surfaces expired invitation and network errors", async () => {
    mocks.preview.mockRejectedValue(new Error("Invitation expired"));
    render(<JoinGroup />);
    fireEvent.change(screen.getByLabelText("Invite code"), {
      target: { value: "a".repeat(64) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find group" }));
    await screen.findByText("Invitation expired");
    expect(mocks.join).not.toHaveBeenCalled();
  });
  it("shows owner, members and friendly sessions state", () => {
    render(<GroupRoute mode="details" />);
    expect(screen.getByText("Owner: Alice")).toBeTruthy();
    expect(screen.getByText("No active games")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play a Game" }));
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: "/games",
      params: { groupId: id },
    });
    expect(screen.queryByText("Create group session")).toBeNull();
  });
  it("confirms ownership transfer and member removal", async () => {
    mocks.transfer.mockResolvedValue(null);
    render(<GroupRoute mode="members" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Transfer ownership to Bob" }),
    );
    expect(mocks.transfer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(mocks.transfer).toHaveBeenCalledWith(id, group.members[1].user_id),
    );
  });
  it("hides owner settings and removal controls from members", () => {
    mocks.user = group.members[1].user_id;
    render(<GroupRoute mode="settings" />);
    expect(screen.getByText("Owner access required")).toBeTruthy();
    cleanup();
    render(<GroupRoute mode="members" />);
    expect(screen.queryByRole("button", { name: "Remove Alice" })).toBeNull();
    cleanup();
    render(<GroupRoute mode="details" />);
    expect(screen.getByRole("button", { name: "Leave group" })).toBeTruthy();
  });
  it("generates, copies and revokes an invitation without leaking it to routes", async () => {
    mocks.invite.mockResolvedValue({
      id,
      group_id: id,
      code: "a".repeat(64),
      expires_at: "2026-11-01",
      max_uses: 1,
      use_count: 0,
    });
    mocks.copy.mockResolvedValue(true);
    mocks.revoke.mockResolvedValue(null);
    render(<GroupRoute mode="invites" />);
    fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
    await screen.findByLabelText("Your invite code");
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    await screen.findByText("Invite code copied.");
    expect(mocks.copy).toHaveBeenCalledWith("a".repeat(64));
    fireEvent.click(
      screen.getByRole("button", {
        name: `Revoke invitation ${id.slice(0, 8)}`,
      }),
    );
    await screen.findByText("Invitation revoked.");
    expect(screen.queryByLabelText("Your invite code")).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

it("offers optional vice setup during creation and explains succession", async () => {
  mocks.create.mockResolvedValue(group);
  render(<CreateGroup />);
  fireEvent.click(screen.getByText("Add a vice owner later"));
  expect(screen.getByText(/vice owner takes over/i)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Group name"), {
    target: { value: "Friends" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create Group" }));
  await waitFor(() =>
    expect(mocks.replace).toHaveBeenCalledWith(`/group/${id}/members`),
  );
});

it("lets the owner designate a vice with confirmation", async () => {
  render(<GroupRoute mode="members" />);
  fireEvent.click(screen.getByText("Make Bob vice owner"));
  expect(screen.getByText(/takes over when you leave or delete/i)).toBeTruthy();
  fireEvent.click(screen.getByText("Confirm"));
  await waitFor(() =>
    expect(mocks.setVice).toHaveBeenCalledWith(id, group.members[1].user_id),
  );
});

it("blocks owner leave until a vice is appointed and shows the successor", () => {
  render(<GroupRoute mode="details" />);
  expect(
    screen
      .getByRole("button", { name: "Leave group" })
      .hasAttribute("disabled"),
  ).toBe(true);
  cleanup();
  mocks.resource.mockReturnValue({
    data: { ...group, vice_owner_id: group.members[1].user_id },
    loading: false,
    refresh: vi.fn(),
  });
  render(<GroupRoute mode="details" />);
  fireEvent.click(screen.getByText("Leave group"));
  expect(screen.getByText(/Bob will become the owner/)).toBeTruthy();
});

it("recognizes existing membership without redeeming the invitation again", async () => {
  mocks.resource.mockReturnValue({ data: [group], loading: false });
  mocks.preview.mockResolvedValue(group);
  render(<JoinGroup />);
  fireEvent.change(screen.getByLabelText("Invite code"), {
    target: { value: "a".repeat(64) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find group" }));
  await screen.findByText("You’re already a member.");
  expect(screen.queryByRole("button", { name: "Join group" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open group" }));
  expect(mocks.join).not.toHaveBeenCalled();
  expect(mocks.replace).toHaveBeenCalledWith(`/group/${id}`);
});

it("only acknowledges sharing when the native share operation reports success", async () => {
  mocks.invite.mockResolvedValue({
    id,
    group_id: id,
    code: "a".repeat(64),
    expires_at: null,
    max_uses: null,
    use_count: 0,
  });
  const share = vi
    .spyOn(Share, "share")
    .mockResolvedValueOnce({
      action: Share.dismissedAction,
      activityType: undefined,
    })
    .mockResolvedValueOnce({
      action: Share.sharedAction,
      activityType: undefined,
    });
  render(<GroupRoute mode="invites" />);
  fireEvent.click(screen.getByRole("button", { name: "Create invite" }));
  await screen.findByLabelText("Your invite code");
  fireEvent.click(screen.getByRole("button", { name: "Share code" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/Invitation shared/)).toBeNull();
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Share code" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Share code" }));
  await screen.findByText(
    "Invitation shared. Your friend can use the code to join.",
  );
  expect(share.mock.calls[1][0].message).toContain("a".repeat(64));
  share.mockRestore();
});
