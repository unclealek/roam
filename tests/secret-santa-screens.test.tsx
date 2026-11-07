// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import {
  SantaCreate,
  SantaJoin,
  SantaLobby,
} from "../src/presentation/secret-santa/SantaScreens";
const m = vi.hoisted(() => ({
  resource: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  preview: vi.fn(),
  redeem: vi.fn(),
  edit: vi.fn(),
  close: vi.fn(),
  draw: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  extend: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  invite: vi.fn(),
  revoke: vi.fn(),
  replace: vi.fn(),
  copy: vi.fn(),
  user: "11111111-1111-4111-8111-111111111111",
}));
const id = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
vi.mock("expo-router", () => ({
  router: { replace: m.replace, back: vi.fn() },
  useLocalSearchParams: () => ({ sessionId: id }),
  useFocusEffect: (fn: () => void) => React.useEffect(() => fn(), [fn]),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => id }));
vi.mock("expo-clipboard", () => ({ setStringAsync: m.copy }));
vi.mock("../src/games/secret-santa/service", () => ({ santaService: m }));
vi.mock("../src/platform/groups/service", () => ({
  groupService: { list: vi.fn() },
}));
vi.mock("../src/platform/auth/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: m.user } } }),
}));
vi.mock("../src/platform/sessions/useAccountResource", () => ({
  useAccountResource: m.resource,
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
const settings = {
  session_id: id,
  joining_deadline: "2035-12-10T20:00:00Z",
  exchange_date: "2035-12-25",
  exchange_timezone: "Europe/Helsinki",
  currency_code: "EUR",
  max_participants: 100,
  identity_reveal_enabled: true,
  mind_match_enabled: false,
  secret_agent_enabled: false,
  secret_missions_enabled: false,
  lobby_phase: "joining_open",
  updated_at: "2035-01-01",
};
const lobby = {
  id,
  name: "Winter",
  game_type_id: "secret_santa",
  host_id: id,
  status: "lobby",
  server_now: "2035-01-01T00:00:00Z",
  settings,
  host: { display_name: "Alice" },
  participant_count: 2,
  participants: [
    { id, user_id: id, display_name: "Alice", role: "host" },
    { id: bob, user_id: bob, display_name: "Bob", role: "member" },
  ],
  invitations: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  m.user = id;
  m.resource.mockReturnValue({ data: lobby, refresh: vi.fn() });
});
afterEach(cleanup);
it("sets up default EUR, optional group, native-friendly dates and configuration-only activity toggles", async () => {
  m.resource.mockReturnValue({ data: [{ id, name: "Friends" }] });
  m.create.mockResolvedValue({ id });
  render(<SantaCreate />);
  fireEvent.click(screen.getByRole("button", { name: "Friends" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(
    (screen.getByLabelText("Currency code") as HTMLInputElement).value,
  ).toBe("EUR");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Mind Match: Off" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Create Game" }));
  await waitFor(() =>
    expect(m.create).toHaveBeenCalledWith(
      "Secret Santa with Friends",
      expect.objectContaining({ mind_match_enabled: true }),
      id,
      id,
    ),
  );
  expect(m.replace).toHaveBeenCalledWith(`/game/secret_santa/lobby/${id}`);
});
it("requires safe preview and explicit confirmation before redeeming an invitation", async () => {
  m.preview.mockResolvedValue({
    id,
    name: "Winter",
    participant_count: 2,
    joining_deadline: settings.joining_deadline,
  });
  m.redeem.mockResolvedValue({ id });
  render(<SantaJoin />);
  fireEvent.change(screen.getByLabelText("Invite code"), {
    target: { value: "ab".repeat(32) },
  });
  fireEvent.click(screen.getByText("Find game"));
  const join = await screen.findByRole("button", {
    name: "Join Secret Santa",
  });
  expect(m.redeem).not.toHaveBeenCalled();
  fireEvent.click(join);
  await waitFor(() => expect(m.redeem).toHaveBeenCalled());
});
it("displays date-only exchange, participant count and confirmed host close controls without a draw button", async () => {
  render(<SantaLobby />);
  expect(
    screen.getByText("Gift exchange: 2035-12-25 · Europe/Helsinki"),
  ).toBeTruthy();
  expect(screen.getByText("2 / 100 participants · minimum 3")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /draw/i })).toBeNull();
  fireEvent.click(screen.getByText("Close joining early"));
  expect(m.close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm lobby action" }));
  await waitFor(() => expect(m.close).toHaveBeenCalledWith(id));
});
it("hides host controls from members and locks settings after closure", () => {
  m.user = bob;
  render(<SantaLobby />);
  expect(screen.queryByText("Host controls")).toBeNull();
  expect(screen.getByText("Leave gift exchange")).toBeTruthy();
  cleanup();
  m.user = id;
  m.resource.mockReturnValue({
    data: {
      ...lobby,
      settings: { ...settings, lobby_phase: "ready_for_draw" },
    },
    refresh: vi.fn(),
  });
  render(<SantaLobby />);
  expect(screen.queryByText("Edit game settings")).toBeNull();
  expect(screen.getByText(/Ready for draw/)).toBeTruthy();
});
it("shows insufficient-player recovery, group opt-in, errors and loading states", () => {
  for (const state of [
    { loading: true },
    { error: "Offline", refresh: vi.fn() },
    {
      data: {
        id,
        name: "Winter",
        preview: true,
        participant_count: 1,
        can_join: true,
      },
    },
    {
      data: {
        ...lobby,
        settings: { ...settings, lobby_phase: "insufficient_players" },
      },
      refresh: vi.fn(),
    },
  ]) {
    m.resource.mockReturnValue(state);
    const v = render(<SantaLobby />);
    expect(v.container.textContent).toMatch(
      /Gathering|Offline|Join this Secret Santa|Extend joining deadline/,
    );
    cleanup();
  }
});

it("requires confirmation for early draw and warns of permanent closure", async () => {
  m.resource.mockReturnValue({
    data: { ...lobby, participant_count: 3 },
    refresh: vi.fn(),
  });
  m.get.mockResolvedValue({ ...lobby, participant_count: 3 });
  m.draw.mockResolvedValue({});
  render(<SantaLobby />);
  fireEvent.click(screen.getByText("Draw names"));
  expect(m.draw).not.toHaveBeenCalled();
  expect(screen.getByText(/Joining will close and/)).toBeTruthy();
  fireEvent.click(screen.getByText("Start Draw"));
  await waitFor(() => expect(m.draw).toHaveBeenCalledWith(id));
});
it("matched lobby shows private recipient action and no membership controls or draw", () => {
  m.resource.mockReturnValue({
    data: {
      ...lobby,
      status: "active",
      settings: { ...settings, lobby_phase: "matched" },
    },
    refresh: vi.fn(),
  });
  render(<SantaLobby />);
  expect(screen.getByText(/Game Started/)).toBeTruthy();
  expect(screen.getByText("Reveal My Recipient")).toBeTruthy();
  expect(screen.queryByText("Draw names")).toBeNull();
  expect(screen.queryByText("Cancel gift exchange")).toBeNull();
});

it("keeps entered setup values and validates dates before advancing", () => {
  m.resource.mockReturnValue({ data: [] });
  render(<SantaCreate />);
  fireEvent.change(screen.getByLabelText("Game name"), {
    target: { value: "Our circle" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("Suggested gift budget (optional)"), {
    target: { value: "-5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText(/positive budget/)).toBeTruthy();
  expect(m.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
  expect((screen.getByLabelText("Game name") as HTMLInputElement).value).toBe(
    "Our circle",
  );
});
it("does not start a draw when eligibility has changed on the server", async () => {
  m.resource.mockReturnValue({
    data: { ...lobby, participant_count: 3 },
    refresh: vi.fn(),
  });
  m.get.mockResolvedValue({
    ...lobby,
    status: "active",
    settings: { ...settings, lobby_phase: "matched" },
  });
  render(<SantaLobby />);
  fireEvent.click(screen.getByRole("button", { name: "Draw names" }));
  fireEvent.click(screen.getByRole("button", { name: "Start Draw" }));
  await screen.findAllByText(/The game has changed/);
  expect(m.draw).not.toHaveBeenCalled();
});
it("drawing never presents success or host actions; failed draws can refresh", () => {
  m.resource.mockReturnValue({
    data: { ...lobby, settings: { ...settings, lobby_phase: "drawing" } },
    refresh: vi.fn(),
  });
  render(<SantaLobby />);
  expect(screen.getByText("Secret Santa draw")).toBeTruthy();
  expect(screen.queryByText("Host controls")).toBeNull();
  expect(screen.queryByText("Reveal My Recipient")).toBeNull();
  cleanup();
  m.resource.mockReturnValue({
    data: { ...lobby, settings: { ...settings, lobby_phase: "draw_failed" } },
    refresh: vi.fn(),
  });
  render(<SantaLobby />);
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.queryByText("Reveal My Recipient")).toBeNull();
});
it("keeps pending draw private and prevents duplicate submission", async () => {
  m.resource.mockReturnValue({
    data: { ...lobby, participant_count: 3 },
    refresh: vi.fn(),
  });
  m.get.mockResolvedValue({ ...lobby, participant_count: 3 });
  m.draw.mockRejectedValue(
    new Error("Connection interrupted. Refresh to check the result."),
  );
  render(<SantaLobby />);
  fireEvent.click(screen.getByRole("button", { name: "Draw names" }));
  const start = screen.getByRole("button", { name: "Start Draw" });
  fireEvent.click(start);
  fireEvent.click(start);
  await screen.findAllByText(/Connection interrupted/);
  expect(m.draw).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Reveal My Recipient")).toBeNull();
});

it("does not claim an invitation was copied when the clipboard rejects the write", async () => {
  m.invite.mockResolvedValue({
    id: "new-invite",
    code: "ab".repeat(32),
    expires_at: "2036-01-01T00:00:00Z",
  });
  m.copy.mockResolvedValue(false);
  render(<SantaLobby />);
  fireEvent.click(screen.getByRole("button", { name: "New invite" }));
  fireEvent.click(await screen.findByRole("button", { name: "Copy code" }));
  await screen.findByText("Copy failed. Select the code to copy it.");
  expect(screen.queryByText("Invite code copied.")).toBeNull();
});

it("does not restart a pending lobby read before its timeout can finish", async () => {
  vi.useFakeTimers();
  try {
    const refresh = vi.fn();
    m.resource.mockReturnValue({ loading: true, refreshing: false, refresh });
    render(<SantaLobby />);
    await vi.advanceTimersByTimeAsync(15000);
    expect(refresh).not.toHaveBeenCalled();
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});
