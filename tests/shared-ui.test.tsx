// @vitest-environment jsdom
import React from "react";
import "./fixtures/brand-native-mocks";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RoamButton } from "../src/presentation/brand/ui";
import { RoamDialog, RoamSheet } from "../src/presentation/brand/overlays";
import {
  FeedbackProvider,
  useFeedback,
} from "../src/presentation/brand/ToastFeedback";
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
afterEach(cleanup);
it("keeps every button variant usable and guards an asynchronous action against duplicate presses", async () => {
  let release!: () => void;
  const action = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  render(
    <RoamButton label="Save" variant="primary" size="small" onPress={action} />,
  );
  const button = screen.getByRole("button", { name: "Save" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(action).toHaveBeenCalledOnce();
  expect(button.hasAttribute("disabled")).toBe(true);
  release();
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
});
it("renders loading and disabled controls without calling their actions", () => {
  const action = vi.fn();
  render(
    <>
      <RoamButton label="Working" loading onPress={action} />
      <RoamButton
        label="Delete"
        variant="destructive"
        disabled
        onPress={action}
      />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Working" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(action).not.toHaveBeenCalled();
});
it("requires explicit confirmation and disables cancellation while a destructive action is busy", () => {
  const confirm = vi.fn(),
    cancel = vi.fn();
  const { rerender } = render(
    <RoamDialog
      visible
      title="Leave group?"
      message="You can rejoin with a new invitation."
      kind="destructive"
      onConfirm={confirm}
      onCancel={cancel}
    />,
  );
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(confirm).toHaveBeenCalledOnce();
  rerender(
    <RoamDialog
      visible
      busy
      title="Leave group?"
      message="Working"
      kind="destructive"
      onConfirm={confirm}
      onCancel={cancel}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancel).not.toHaveBeenCalled();
});
it("presents a named sheet and lets the user close it", () => {
  const close = vi.fn();
  render(
    <RoamSheet visible title="Profile actions" onClose={close}>
      <RoamButton label="Edit Profile" onPress={vi.fn()} />
    </RoamSheet>,
  );
  expect(screen.getByText("Profile actions")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close sheet" }));
  expect(close).toHaveBeenCalledOnce();
});
function FeedbackExample() {
  const feedback = useFeedback();
  return (
    <>
      <RoamButton
        label="Copy"
        onPress={() => {
          feedback?.show({ id: "copy", message: "Code copied." });
          feedback?.show({ id: "copy", message: "Code copied." });
        }}
      />
      <RoamButton
        label="Activity"
        onPress={() => {
          feedback?.show({
            id: "activity",
            kind: "activity",
            message: "New game activity available.",
          });
        }}
      />
    </>
  );
}
it("deduplicates feedback and suppresses activity on critical screens", () => {
  render(
    <FeedbackProvider suppressActivity>
      <FeedbackExample />
    </FeedbackProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  expect(screen.getAllByText("Code copied.")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Activity" }));
  expect(screen.queryByText("New game activity available.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss feedback" }));
  expect(screen.queryByText("Code copied.")).toBeNull();
});

it("dismisses a routine toast after its timeout without blocking content", () => {
  vi.useFakeTimers();
  try {
    render(
      <FeedbackProvider>
        <FeedbackExample />
      </FeedbackProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByText("Code copied.")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("Code copied.")).toBeNull();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

it("keeps all variants and sizes at accessible touch targets with visible keyboard focus", () => {
  const variants = [
    "primary",
    "secondary",
    "outline",
    "ghost",
    "destructive",
    "glass",
  ] as const;
  const sizes = ["small", "medium", "large"] as const;
  const action = vi.fn();
  render(
    <>
      {variants.flatMap((variant) =>
        sizes.map((size) => (
          <RoamButton
            key={`${variant}-${size}`}
            label={`${variant}-${size}`}
            variant={variant}
            size={size}
            onPress={action}
          />
        )),
      )}
    </>,
  );
  for (const variant of variants)
    for (const size of sizes) {
      const button = screen.getByRole("button", { name: `${variant}-${size}` });
      expect(parseFloat(button.style.minHeight)).toBeGreaterThanOrEqual(44);
      fireEvent.click(button);
    }
  expect(action).toHaveBeenCalledTimes(18);
  const focused = screen.getByRole("button", { name: "primary-small" });
  fireEvent.focus(focused);
  expect(parseFloat(focused.style.borderTopWidth)).toBeGreaterThanOrEqual(2);
});
