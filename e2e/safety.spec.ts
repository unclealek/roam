import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

const loadFixture = createRequire(`${process.cwd()}/package.json`);
const { createAuditBackend } = loadFixture(
  "./e2e/fixtures/button-audit-backend.cjs",
);

test("a group member reports the group and another member", async ({
  page,
}) => {
  const backend = createAuditBackend({ role: "member" });
  const { group, bob } = backend.ids;
  const reports: unknown[] = [];
  await page.addInitScript(
    (session) =>
      localStorage.setItem("sb-127-auth-token", JSON.stringify(session)),
    backend.state.sessionToken,
  );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (
      new URL(request.url()).pathname === "/rest/v1/rpc/submit_safety_report"
    ) {
      reports.push(request.postDataJSON());
      return route.fulfill({ status: 204, headers });
    }
    const result = backend.handle(
      request.method(),
      request.url(),
      request.postData() ? request.postDataJSON() : {},
    );
    return route.fulfill({
      status: result.status,
      headers,
      ...(result.json === undefined ? { body: "" } : { json: result.json }),
    });
  });

  await page.goto(`/group/${group}`);
  await page.getByRole("button", { name: "Report group", exact: true }).click();
  await page.getByRole("radio", { name: "Spam or scam" }).click();
  await page
    .getByRole("textbox", { name: /Explanation/ })
    .fill("Suspicious links");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(
    page.getByText("Report received. Thank you for helping keep Roam safe."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "View members" }).click();
  await expect(
    page.getByRole("button", { name: "Report member Alex" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Report member Blair" }).click();
  await page.getByRole("radio", { name: "Offensive display name" }).click();
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(
    page.getByText("Report received. Thank you for helping keep Roam safe."),
  ).toBeVisible();
  expect(reports).toEqual([
    {
      p_group_id: group,
      p_user_id: null,
      p_reason: "spam_scam",
      p_description: "Suspicious links",
    },
    {
      p_group_id: group,
      p_user_id: bob,
      p_reason: "offensive_display_name",
      p_description: null,
    },
  ]);
});
