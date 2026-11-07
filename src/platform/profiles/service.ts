import { requireSupabase } from "../supabase";
import { normalizeDisplayName } from "./validation";
export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};
export async function loadProfile(id: string): Promise<Profile> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("id,display_name,created_at,updated_at")
    .eq("id", id)
    .single();
  if (error)
    throw new Error(
      "Unable to load your profile. Check your connection and retry.",
    );
  return data as Profile;
}
export async function saveProfile(id: string, input: string): Promise<Profile> {
  const display_name = normalizeDisplayName(input);
  const { data, error } = await requireSupabase()
    .from("profiles")
    .update({ display_name })
    .eq("id", id)
    .select("id,display_name,created_at,updated_at")
    .single();
  if (error) throw new Error("Unable to save your profile. Please retry.");
  return data as Profile;
}
