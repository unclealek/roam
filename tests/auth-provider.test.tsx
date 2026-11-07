// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../src/platform/auth/AuthProvider";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  subscribe: vi.fn(),
  load: vi.fn(),
  unsubscribe: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("../src/platform/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.subscribe,
      startAutoRefresh: mocks.start,
      stopAutoRefresh: mocks.stop,
    },
  },
}));
vi.mock("../src/platform/profiles/service", () => ({
  loadProfile: mocks.load,
}));
const session = { user: { id: "alice" } };
let change: (event: string, next: unknown) => void;
function Probe() {
  const a = useAuth();
  return (
    <>
      <span>
        {a.loading ? "restoring" : (a.session?.user.id ?? "signed out")}
      </span>
      <span>{a.profile?.display_name}</span>
      <span>{a.error}</span>
      <button onClick={a.retry}>Retry</button>
    </>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.subscribe.mockImplementation((cb) => {
    change = cb;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.load.mockResolvedValue({ id: "alice", display_name: "Alice" });
});
afterEach(cleanup);
describe("persistent session lifecycle", () => {
  it("restores a stored session and loads its profile", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("Alice");
    expect(screen.getByText("alice")).toBeTruthy();
    cleanup();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(mocks.stop).toHaveBeenCalled();
  });
  it("does not overwrite a newer sign-in with stale hydration", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getSession.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      change("SIGNED_IN", session);
      resolve({ data: { session: null }, error: null });
    });
    await screen.findByText("Alice");
    expect(screen.queryByText("signed out")).toBeNull();
  });
  it("clears private profile data when signed out", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText("Alice");
    await act(async () => {
      change("SIGNED_OUT", null);
    });
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.getByText("signed out")).toBeTruthy();
  });
  it("ignores an old profile request after sign-out", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.load.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    await act(async () => {
      change("SIGNED_OUT", null);
    });
    await act(async () => {
      resolve({ id: "alice", display_name: "Private" });
    });
    expect(screen.queryByText("Private")).toBeNull();
  });
  it("shows retryable profile errors", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.load.mockRejectedValue(new Error("offline"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText(/Unable to load your profile/)).toBeTruthy();
  });
  it("shows session restoration failures instead of an endless spinner", async () => {
    mocks.getSession.mockRejectedValue(new Error("offline"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(
      await screen.findByText(/Unable to restore your session/),
    ).toBeTruthy();
  });
});
