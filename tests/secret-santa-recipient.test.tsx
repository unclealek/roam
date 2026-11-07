// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import {
  RecipientContent,
  SantaRecipient,
  exchangeCountdown,
} from "../src/presentation/secret-santa/SantaRecipient";
import type { SantaAssignment } from "../src/games/secret-santa/types";
const m = vi.hoisted(() => ({
  reveal: vi.fn(),
  replace: vi.fn(),
  resource: vi.fn(),
}));
vi.mock("expo-router", () => ({
  router: { replace: m.replace },
  useLocalSearchParams: () => ({ sessionId: "session" }),
}));
vi.mock("../src/games/secret-santa/service", () => ({
  santaService: { reveal: m.reveal },
}));
vi.mock("../src/platform/sessions/useAccountResource", () => ({
  useAccountResource: m.resource,
}));
vi.mock("../src/presentation/rewards/RewardMotion", () => ({
  RewardMotion: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
const hidden = {
  session_id: "session",
  name: "Winter",
  status: "active",
  settings: {
    exchange_date: "2035-12-25",
    exchange_timezone: "Europe/Helsinki",
    currency_code: "EUR",
    budget_amount: 30,
    description: "Thoughtful gifts",
    mind_match_enabled: true,
    secret_agent_enabled: true,
  },
  server_now: "2035-12-20T12:00:00Z",
  revealed_at: null,
  recipient: null,
} as SantaAssignment;
const shown = {
  ...hidden,
  revealed_at: "2035-12-20T12:01:00Z",
  recipient: { display_name: "Robin", available: true },
};
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("keeps name hidden until tap, reveals with gift details, and continues", async () => {
  m.reveal.mockResolvedValue(shown);
  render(<RecipientContent assignment={hidden} refresh={vi.fn()} />);
  expect(screen.queryByText("Robin")).toBeNull();
  fireEvent.click(screen.getByText("Reveal my recipient"));
  await waitFor(() => expect(screen.getByText("Robin")).toBeTruthy());
  expect(m.reveal).toHaveBeenCalledWith("session");
  expect(screen.getByText(/5 days until/)).toBeTruthy();
  expect(screen.getByText(/30 EUR/)).toBeTruthy();
  expect(screen.getByText(/Keep it secret/)).toBeTruthy();
  expect(screen.queryByText(/Mind Match/)).toBeNull();
  expect(screen.queryByText(/Secret Agent/)).toBeNull();
  fireEvent.click(screen.getByText("Continue"));
  expect(m.replace).toHaveBeenCalled();
});
it("revisit uses persisted server reveal and never rerolls", () => {
  render(<RecipientContent assignment={shown} refresh={vi.fn()} />);
  expect(screen.getByText("Robin")).toBeTruthy();
  expect(screen.queryByText("Reveal my recipient")).toBeNull();
  expect(m.reveal).not.toHaveBeenCalled();
});
it("failed reveal can retry without showing a recipient", async () => {
  m.reveal.mockRejectedValue(new Error("offline"));
  render(<RecipientContent assignment={hidden} refresh={vi.fn()} />);
  fireEvent.click(screen.getByText("Reveal my recipient"));
  await waitFor(() =>
    expect(screen.getByText(/Couldn’t reveal your recipient/)).toBeTruthy(),
  );
  expect(screen.queryByText("Robin")).toBeNull();
});
it("shows loading, offline retry, and unavailable states", () => {
  m.resource.mockReturnValue({ loading: true });
  const r = render(<SantaRecipient />);
  expect(screen.getByText(/Opening your recipient/)).toBeTruthy();
  m.resource.mockReturnValue({
    error: "Check your connection",
    refresh: vi.fn(),
  });
  r.rerender(<SantaRecipient />);
  expect(screen.getByText("Try again")).toBeTruthy();
  m.resource.mockReturnValue({ data: null });
  r.rerender(<SantaRecipient />);
  expect(screen.getByText(/isn’t ready yet/)).toBeTruthy();
});
it("calendar countdown respects local timezone and date-only semantics", () => {
  expect(
    exchangeCountdown(
      "2035-12-25",
      "Europe/Helsinki",
      new Date("2035-12-24T23:30:00Z"),
    ),
  ).toBe("Gift exchange is today!");
  expect(
    exchangeCountdown(
      "2035-12-25",
      "America/New_York",
      new Date("2035-12-25T00:30:00Z"),
    ),
  ).toBe("1 day until the exchange");
  expect(
    exchangeCountdown("2035-12-25", "UTC", new Date("2035-12-26T12:00:00Z")),
  ).toMatch(/passed/);
});
