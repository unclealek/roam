import { requireSupabase } from "../supabase";
import type { Json } from "../database.types";
import type {
  NotificationPage,
  NotificationPreferences,
  UserNotification,
} from "./types";
async function account<T>(action: string, data: Json = {}) {
  const result = await requireSupabase().rpc("notification_account", {
    p_action: action,
    p_data: data,
  });
  if (result.error)
    throw new Error("Unable to update notifications. Please try again.");
  return result.data as T;
}
export const getPreferences = () =>
  account<NotificationPreferences>("preferences");
export const savePreferences = (
  patch: Partial<Omit<NotificationPreferences, "user_id" | "updated_at">>,
) => account<NotificationPreferences>("save_preferences", patch);
export const listNotifications = (
  before?: Pick<UserNotification, "created_at" | "id">,
) =>
  account<NotificationPage>(
    "list",
    before
      ? { before_created_at: before.created_at, before_id: before.id }
      : {},
  );
export const markNotification = (id: string, read = true) =>
  account<boolean>("read", { id, read });
export const registerDevice = (
  token: string,
  platform: "ios" | "android",
  deviceIdentifier: string,
) =>
  account<boolean>("register_device", {
    expo_push_token: token,
    platform,
    device_identifier: deviceIdentifier,
  });
export const deactivateDevice = (deviceIdentifier: string) =>
  account<boolean>("deactivate_device", {
    device_identifier: deviceIdentifier,
  });
export async function getNotification(id: string) {
  const { data, error } = await requireSupabase()
    .from("user_notifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Unable to open notification.");
  return data;
}
