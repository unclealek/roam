import { checkSafetyText } from "../safety/content";
import { requireSupabase } from "../supabase";
import type { Database } from "../database.types";
import { sessionId, readSession } from "../sessions/validation";
import {
  groupIcons,
  type GroupInput,
  type GroupPreview,
  type Group,
  type GroupDetails,
  type NewInvite,
} from "./types";
type Functions = Database["public"]["Functions"];
export type GroupRpc =
  | "create_group"
  | "list_my_groups"
  | "get_group"
  | "update_group"
  | "leave_group"
  | "remove_group_member"
  | "transfer_group_ownership"
  | "set_group_vice_owner"
  | "delete_group"
  | "create_group_invite"
  | "revoke_group_invite"
  | "preview_group_invite"
  | "redeem_group_invite";
export type GroupInvoker = <N extends GroupRpc>(
  name: N,
  args: Functions[N]["Args"],
) => PromiseLike<{ data: unknown; error: unknown }>;
export function validateGroup(input: GroupInput, previous?: GroupInput) {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const icon_key = input.icon_key || null;
  if (!name || [...name].length > 80 || /[\x00-\x1f\x7f]/.test(name))
    throw new Error("Enter a group name of 1–80 characters.");
  if (
    description &&
    ([...description].length > 500 || /[\x00-\x1f\x7f]/.test(description))
  )
    throw new Error(
      "Use a description of up to 500 characters without line breaks.",
    );
  if (icon_key && !Object.hasOwn(groupIcons, icon_key))
    throw new Error("Choose one of the group icons.");
  if (name !== previous?.name) checkSafetyText(name);
  if (description && description !== previous?.description)
    checkSafetyText(description);
  return { name, description, icon_key };
}
export function invitationCode(value: string) {
  const code = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(code))
    throw new Error("Enter the complete 64-character invitation code.");
  return code;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid group response.");
  return value as Record<string, unknown>;
}
function preview(value: unknown): GroupPreview {
  const r = record(value);
  if (
    typeof r.id !== "string" ||
    typeof r.name !== "string" ||
    typeof r.member_count !== "number" ||
    !(r.description === null || typeof r.description === "string") ||
    !(r.icon_key === null || typeof r.icon_key === "string")
  )
    throw new Error("Invalid group response.");
  sessionId(r.id);
  return r as GroupPreview;
}
function group(value: unknown): Group {
  const r = record(value);
  preview(r);
  if (
    typeof r.owner_id !== "string" ||
    typeof r.created_at !== "string" ||
    typeof r.updated_at !== "string"
  )
    throw new Error("Invalid group response.");
  return r as Group;
}
export function createGroupService(invoke: GroupInvoker) {
  async function call<N extends GroupRpc>(name: N, args: Functions[N]["Args"]) {
    const { data, error } = await invoke(name, args);
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.includes("Appoint a vice owner")
    )
      throw new Error(
        "Appoint a vice owner or transfer ownership before leaving this group.",
      );
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      error.message === "Text contains a threat"
    )
      throw new Error("Please remove explicit threats from this text.");
    if (error)
      throw new Error(
        "Unable to complete this group request. Check your connection and permissions, then retry.",
      );
    const code =
      data && typeof data === "object" && "error" in data ? data.error : null;
    if (code === "rate_limited")
      throw new Error(
        "Too many invitation attempts. Wait five minutes and try again.",
      );
    if (code)
      throw new Error(
        "This invitation is invalid, expired, revoked, or fully used. Ask the owner for a new code.",
      );
    return data;
  }
  return {
    async create(input: GroupInput) {
      const v = validateGroup(input);
      return group(
        await call("create_group", {
          p_name: v.name,
          p_description: v.description,
          p_icon_key: v.icon_key,
        }),
      );
    },
    async list() {
      const data = await call("list_my_groups", {});
      if (!Array.isArray(data)) throw new Error("Invalid group list response.");
      return data.map(group);
    },
    async get(id: string): Promise<GroupDetails> {
      const data = record(
        await call("get_group", { p_group_id: sessionId(id) }),
      );
      group(data);
      if (
        !Array.isArray(data.members) ||
        !Array.isArray(data.sessions) ||
        !Array.isArray(data.invites)
      )
        throw new Error("Invalid group details response.");
      for (const m of data.members) {
        const r = record(m);
        if (
          typeof r.user_id !== "string" ||
          typeof r.display_name !== "string" ||
          !["owner", "member"].includes(String(r.role))
        )
          throw new Error("Invalid group member response.");
      }
      data.sessions = data.sessions.map(readSession);
      return data as GroupDetails;
    },
    async update(id: string, input: GroupInput, previous?: GroupInput) {
      const v = validateGroup(input, previous);
      await call("update_group", {
        p_group_id: sessionId(id),
        p_name: v.name,
        p_description: v.description,
        p_icon_key: v.icon_key,
      });
    },
    async leave(id: string) {
      await call("leave_group", { p_group_id: sessionId(id) });
    },
    async remove(id: string, userId: string) {
      await call("remove_group_member", {
        p_group_id: sessionId(id),
        p_user_id: sessionId(userId),
      });
    },
    async transfer(id: string, userId: string) {
      await call("transfer_group_ownership", {
        p_group_id: sessionId(id),
        p_user_id: sessionId(userId),
      });
    },
    async setVice(id: string, userId: string | null) {
      await call("set_group_vice_owner", {
        p_group_id: sessionId(id),
        p_user_id: userId === null ? null : sessionId(userId),
      });
    },
    async delete(id: string) {
      await call("delete_group", { p_group_id: sessionId(id) });
    },
    async invite(
      id: string,
      days = 7,
      maxUses: number | null = null,
    ): Promise<NewInvite> {
      if (
        !Number.isInteger(days) ||
        days < 1 ||
        days > 30 ||
        (maxUses !== null &&
          (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 2147483647))
      )
        throw new Error(
          "Choose 1–30 days and a positive whole-number use limit.",
        );
      const r = record(
        await call("create_group_invite", {
          p_group_id: sessionId(id),
          p_days: days,
          p_max_uses: maxUses,
        }),
      );
      if (typeof r.code !== "string" || typeof r.id !== "string")
        throw new Error("Invalid invitation response.");
      invitationCode(r.code);
      return r as NewInvite;
    },
    async revoke(id: string, inviteId: string) {
      await call("revoke_group_invite", {
        p_group_id: sessionId(id),
        p_invite_id: sessionId(inviteId),
      });
    },
    async preview(code: string) {
      return preview(
        await call("preview_group_invite", { p_code: invitationCode(code) }),
      );
    },
    async join(code: string) {
      return group(
        await call("redeem_group_invite", { p_code: invitationCode(code) }),
      );
    },
  };
}
export const groupService = createGroupService((name, args) =>
  requireSupabase().rpc(name, args),
);
