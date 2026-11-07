import { requireSupabase } from "../supabase";
/** RLS applies membership, target, status and server-time checks. No device clock. */
export async function getAvailableActivities(sessionId: string) {
  const { data, error } = await requireSupabase()
    .from("scheduled_activities")
    .select("*")
    .eq("game_session_id", sessionId)
    .eq("status", "available");
  if (error) throw new Error("Unable to load activities.");
  return data;
}
