import { requireSupabase } from "../supabase";
import { reportDescription, type ReportTarget } from "./report";

export async function submitReport(
  target: ReportTarget,
  reason: string,
  description: string,
) {
  const { error } = await requireSupabase().rpc("submit_safety_report", {
    p_group_id: target.groupId,
    p_user_id: target.type === "user" ? target.userId : null,
    p_reason: reason,
    p_description: reportDescription(description),
  });
  if (error?.message === "safety_report_rate_limited")
    throw new Error("You’ve reached the report limit. Try again in an hour.");
  if (error?.code === "42501")
    throw new Error(
      "This report couldn’t be sent. Check that you’re signed in and the group or member is still available.",
    );
  if (error) throw new Error("Unable to send your report. Please try again.");
}
