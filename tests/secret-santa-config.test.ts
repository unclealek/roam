import { it, expect } from "vitest";
import { validateSantaSettings } from "../src/games/secret-santa/config";
const c = {
  joining_deadline: "2035-12-10T20:00:00Z",
  exchange_date: "2035-12-25",
  exchange_timezone: "Europe/Helsinki",
  currency_code: "EUR",
  max_participants: 100,
  identity_reveal_enabled: true,
  mind_match_enabled: false,
  secret_agent_enabled: false,
  secret_missions_enabled: false,
};
it("validates dates, timezone, budget, currency and configuration-only options", () => {
  expect(validateSantaSettings(c).currency_code).toBe("EUR");
  for (const bad of [
    { joining_deadline: "2000-01-01T00:00:00Z" },
    { joining_deadline: "2035-12-10T20:00:00" },
    { exchange_date: "2035-12-10" },
    { exchange_date: "2035-02-30" },
    { exchange_timezone: "Mars/Space" },
    { budget_amount: 0 },
    { budget_amount: 1.234 },
    { currency_code: "ZZZ" },
    { max_participants: 101 },
    { mind_match_enabled: "true" },
    { secret_assignment: "private" },
  ])
    expect(() => validateSantaSettings({ ...c, ...bad })).toThrow();
});

it("compares the calendar exchange date in its chosen timezone across DST", () => {
  expect(() =>
    validateSantaSettings({
      ...c,
      joining_deadline: "2035-03-25T23:30:00Z",
      exchange_date: "2035-03-26",
    }),
  ).toThrow();
  expect(
    validateSantaSettings({
      ...c,
      joining_deadline: "2035-03-25T23:30:00Z",
      exchange_date: "2035-03-27",
    }).exchange_date,
  ).toBe("2035-03-27");
});
