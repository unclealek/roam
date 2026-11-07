// @vitest-environment jsdom
import type { ReactNode } from "react";
import "./fixtures/brand-native-mocks";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ReportSheet } from "../src/presentation/safety/ReportSheet";

const submit = vi.hoisted(() => vi.fn());
vi.mock("../src/platform/safety/service", () => ({ submitReport: submit }));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("expo-router", () => ({ router: { back: vi.fn() } }));
afterEach(() => {
  cleanup();
  submit.mockReset();
});

test("member sheet retries a failed submission and confirms success", async () => {
  submit
    .mockRejectedValueOnce(new Error("Try again"))
    .mockResolvedValueOnce(undefined);
  const target = {
    type: "user",
    groupId: "group",
    userId: "member",
    displayName: "Bob",
  } as const;
  const close = vi.fn();
  render(<ReportSheet target={target} onClose={close} />);
  expect(
    screen.getByRole("radio", { name: "Offensive display name" }),
  ).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Spam or scam" })).toBeNull();
  const button = screen.getByRole("button", { name: "Submit report" });
  expect(button.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(
    screen.getByRole("radio", { name: "Offensive display name" }),
  );
  fireEvent.click(button);
  await screen.findByText("Try again");
  await waitFor(() =>
    expect(button.getAttribute("aria-disabled")).not.toBe("true"),
  );
  fireEvent.click(button);
  await screen.findByText(
    "Report received. Thank you for helping keep Roam safe.",
  );
  expect(submit).toHaveBeenCalledTimes(2);
  expect(submit).toHaveBeenLastCalledWith(target, "offensive_display_name", "");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(close).toHaveBeenCalledOnce();
});

test("group sheet cancels without sending a report", () => {
  const close = vi.fn();
  render(
    <ReportSheet
      target={{ type: "group", groupId: "group" }}
      onClose={close}
    />,
  );
  expect(
    screen.getByRole("radio", {
      name: "Inappropriate group name or description",
    }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(close).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
});
