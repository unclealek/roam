import { expect, test, vi } from "vitest";
import { validateGroup } from "../src/platform/groups/service";
import { normalizeDisplayName } from "../src/platform/profiles/validation";
import {
  reportDescription,
  reportReasons,
} from "../src/platform/safety/report";

test("report reasons match the target and descriptions count Unicode characters", () => {
  expect(reportReasons.group.map(([code]) => code)).not.toContain(
    "offensive_display_name",
  );
  expect(reportReasons.user.map(([code]) => code)).not.toContain(
    "inappropriate_group_content",
  );
  expect(reportDescription("   ")).toBeNull();
  expect(reportDescription("🙂".repeat(1000))).toHaveLength(2000);
  expect(() => reportDescription("🙂".repeat(1001))).toThrow("1,000");
});

test("display names accept international names and reject explicit threats", () => {
  expect(normalizeDisplayName("  Nguyễn 李  ")).toBe("Nguyễn 李");
  expect(() => normalizeDisplayName("KILL   ALL MUSLIMS")).toThrow("threats");
});

vi.mock("../src/platform/supabase", () => ({ requireSupabase: vi.fn() }));

test("unchanged legacy group text does not block edits to other fields", () => {
  const legacy = { name: "KILL ALL JEWS" };
  expect(() => validateGroup(legacy)).toThrow("threats");
  expect(
    validateGroup({ ...legacy, description: "Updated description" }, legacy)
      .name,
  ).toBe(legacy.name);
  expect(() =>
    validateGroup({ name: "Friends", description: "kill all gays" }, legacy),
  ).toThrow("threats");
});
