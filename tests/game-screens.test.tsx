// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import Games from "../app/(tabs)/games";
import GameDetails from "../app/(account)/game/[gameId]";
import SessionDetails from "../app/(account)/session/[sessionId]";
import { MyGames } from "../src/presentation/games/MyGames";
import { secretSanta } from "../src/games/secret-santa";
vi.mock("../src/platform/games/registry", async () => {
  const { createGameRegistry } = await vi.importActual<
    typeof import("../src/platform/games/registry")
  >("../src/platform/games/registry");
  const { fixtureGame } = await import("./fixtures/game");
  const { secretSanta } = await import("../src/games/secret-santa");
  return {
    gameRegistry: createGameRegistry([secretSanta, fixtureGame]),
    createGameRegistry,
  };
});
const mock = vi.hoisted(() => ({
  resource: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  params: {
    gameId: "secret_santa",
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  },
  userId: "alice",
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("expo-router", () => ({
  router: { push: mock.push, replace: mock.replace },
  Redirect: ({ href }: { href: string }) => (
    <div data-testid="redirect">{href}</div>
  ),
  useLocalSearchParams: () => mock.params,
}));
vi.mock("../src/platform/sessions/useAccountResource", () => ({
  useAccountResource: mock.resource,
}));
vi.mock("../src/platform/supabase", () => ({ requireSupabase: vi.fn() }));
vi.mock("../src/platform/auth/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { id: mock.userId } } }),
}));
const session = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  host_id: "alice",
  game_type_id: "engine_fixture",
  group_id: null,
  name: "Office friends",
  configuration: {},
  status: "lobby" as const,
  participant_count: 2,
  created_at: "2026-10-26T00:00:00Z",
  started_at: null,
  completed_at: null,
  host: { id: "alice", display_name: "Alice" },
  participants: [
    {
      id: "1",
      user_id: "alice",
      display_name: "Alice",
      role: "host" as const,
      joined_at: "2026-10-26T00:00:00Z",
    },
    {
      id: "2",
      user_id: "bob",
      display_name: "Bob",
      role: "member" as const,
      joined_at: "2026-10-26T00:00:00Z",
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.params.gameId = "secret_santa";
  mock.params.sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  mock.userId = "alice";
});
afterEach(cleanup);
describe("game catalog and details", () => {
  it("renders only registered games, with no misleading standalone activities", () => {
    mock.resource
      .mockReturnValueOnce({
        data: [{ definition: secretSanta, metadata: secretSanta.metadata }],
      })
      .mockReturnValueOnce({ data: [] });
    render(<Games />);
    expect(screen.getByText("Secret Santa")).toBeTruthy();
    expect(screen.queryByText("Mind Match")).toBeNull();
    expect(screen.queryByText("Secret Agent")).toBeNull();
    expect(screen.getByText("No games yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View Secret Santa" }));
    expect(mock.push).toHaveBeenCalledWith("/game/secret_santa");
  });
  it("shows loading and retryable errors for both catalog and sessions", () => {
    const retry = vi.fn();
    mock.resource
      .mockReturnValueOnce({ loading: true })
      .mockReturnValueOnce({ error: "Offline", refresh: retry });
    render(<Games />);
    expect(screen.getByText("Loading games…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });
  it("opens the registered playable setup detail and rejects unknown games", () => {
    render(<GameDetails />);
    expect(
      screen.getByRole("button", { name: "Create Secret Santa" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Create Secret Santa" }),
    );
    expect(mock.push).toHaveBeenCalledWith("/game/secret_santa/create");
    cleanup();
    mock.params.gameId = "unknown";
    render(<GameDetails />);
    expect(screen.getByText("Game unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to Games" }));
    expect(mock.replace).toHaveBeenCalledWith("/games");
  });
  it("lists session status and counts with reusable detail navigation", () => {
    render(<MyGames sessions={[session]} />);
    expect(screen.getByText(/In lobby/)).toBeTruthy();
    expect(screen.getByText("2 participants")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "View session: Office friends" }),
    );
    expect(mock.push).toHaveBeenCalledWith(`/session/${session.id}`);
  });
  it("renders session host, members, and date without widening profile reads", () => {
    mock.resource.mockReturnValue({ data: session });
    render(<SessionDetails />);
    expect(screen.getByText("Host: Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText(/Created /)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start game" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel game" })).toBeTruthy();
  });
  it("hides host editing controls from ordinary participants", () => {
    mock.userId = "bob";
    mock.resource.mockReturnValue({ data: session });
    render(<SessionDetails />);
    expect(screen.queryByLabelText("Game name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
  it("does not carry an edited name into another session route", () => {
    mock.resource.mockReturnValue({ data: session });
    const view = render(<SessionDetails />);
    fireEvent.change(screen.getByLabelText("Game name"), {
      target: { value: "Unsaved old name" },
    });
    mock.params.sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    mock.resource.mockReturnValue({
      data: { ...session, id: mock.params.sessionId, name: "Second session" },
    });
    view.rerender(<SessionDetails />);
    expect((screen.getByLabelText("Game name") as HTMLInputElement).value).toBe(
      "Second session",
    );
  });
  it("handles unavailable session details with a retry state", () => {
    mock.resource.mockReturnValue({
      error: "Session unavailable",
      refresh: vi.fn(),
    });
    render(<SessionDetails />);
    expect(screen.getByText("Session unavailable")).toBeTruthy();
  });
});

it("routes Secret Santa session links to its authorized dedicated lobby", () => {
  mock.resource.mockReturnValue({
    data: { ...session, game_type_id: "secret_santa", settings: {} },
  });
  render(<SessionDetails />);
  expect(screen.getByTestId("redirect").textContent).toContain(
    `/game/secret_santa/lobby/${session.id}`,
  );
});
