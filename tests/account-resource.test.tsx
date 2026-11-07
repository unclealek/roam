// @vitest-environment jsdom
import React, { useEffect } from "react";
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountResource } from "../src/platform/sessions/useAccountResource";
const mock = vi.hoisted(() => ({ userId: "alice" }));
vi.mock("../src/platform/auth/AuthProvider", () => ({
  useAuth: () => ({
    session: mock.userId ? { user: { id: mock.userId } } : null,
  }),
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) =>
    useEffect(effect, [effect]),
}));
function Probe({
  load,
  retain = false,
}: {
  load: () => Promise<string>;
  retain?: boolean;
}) {
  const data = useAccountResource(load, { retainOnRefresh: retain });
  return (
    <>
      <span>{data.loading ? "Loading" : (data.error ?? data.data)}</span>
      <button onClick={data.refresh}>Refresh</button>
    </>
  );
}
beforeEach(() => {
  mock.userId = "alice";
});
afterEach(cleanup);
describe("account-scoped session/catalog resources", () => {
  it("loads and refreshes on request", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce("First")
      .mockResolvedValueOnce("Second");
    render(<Probe load={load} />);
    await screen.findByText("First");
    fireEvent.click(screen.getByText("Refresh"));
    await screen.findByText("Second");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("discards stale responses when the account changes", async () => {
    let resolve!: (value: string) => void;
    const load = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<string>((r) => {
          resolve = r;
        }),
      )
      .mockResolvedValue("Bob");
    const view = render(<Probe load={load} />);
    mock.userId = "bob";
    view.rerender(<Probe load={load} />);
    await screen.findByText("Bob");
    await act(async () => {
      resolve("Alice private sessions");
    });
    expect(screen.queryByText("Alice private sessions")).toBeNull();
  });
  it("clears a previous resource when the route loader changes", async () => {
    const first = vi.fn().mockResolvedValue("First session");
    const second = vi.fn().mockResolvedValue("Second session");
    const view = render(<Probe load={first} />);
    await screen.findByText("First session");
    view.rerender(<Probe load={second} />);
    expect(screen.queryByText("First session")).toBeNull();
    await screen.findByText("Second session");
  });
  it("reports network failures and retries", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue("Recovered");
    render(<Probe load={load} />);
    await screen.findByText(/Unable to load this content/);
    fireEvent.click(screen.getByText("Refresh"));
    await screen.findByText("Recovered");
  });
  it("never fetches private data while signed out", () => {
    mock.userId = "";
    const load = vi.fn();
    render(<Probe load={load} />);
    expect(load).not.toHaveBeenCalled();
  });
});

it("retains lobby content during refresh but clears it on account change", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce("Gift circle")
    .mockReturnValueOnce(new Promise(() => {}))
    .mockReturnValueOnce(new Promise(() => {}));
  const view = render(<Probe load={load} retain />);
  await screen.findByText("Gift circle");
  fireEvent.click(screen.getByText("Refresh"));
  expect(screen.getByText("Gift circle")).toBeTruthy();
  mock.userId = "bob";
  view.rerender(<Probe load={load} retain />);
  expect(screen.queryByText("Gift circle")).toBeNull();
});

it("times out a stalled read, ignores its late response and allows retry", async () => {
  vi.useFakeTimers();
  try {
    let resolve!: (value: string) => void;
    const load = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<string>((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce("Recovered");
    render(<Probe load={load} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(screen.getByText(/Unable to load this content/)).toBeTruthy();
    await act(async () => {
      resolve("Late stale result");
    });
    expect(screen.queryByText("Late stale result")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByText("Refresh"));
    });
    expect(screen.getByText("Recovered")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});
