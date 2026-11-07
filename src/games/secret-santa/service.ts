import { requireSupabase } from "../../platform/supabase";
import { sessionId, sessionName } from "../../platform/sessions/validation";
import { invitationCode } from "../../platform/groups/service";
import { validateSantaSettings } from "./config";
import type {
  SantaAssignment,
  SantaConfig,
  SantaLobby,
  SantaPreview,
  SessionInvite,
} from "./types";
export type SantaAction =
  | "draw"
  | "assignment"
  | "reveal"
  | "create"
  | "get"
  | "join"
  | "preview"
  | "redeem"
  | "edit"
  | "extend"
  | "remove"
  | "close"
  | "cancel"
  | "leave"
  | "invite"
  | "revoke"
  | "group_lobbies";
export type SantaInvoker = (
  action: SantaAction,
  id: string | null,
  data: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
export function createSantaService(invoke: SantaInvoker) {
  async function call<T>(
    action: SantaAction,
    id: string | null = null,
    data: Record<string, unknown> = {},
  ) {
    const r = await invoke(action, id === null ? null : sessionId(id), data);
    if (r.error)
      throw new Error(
        "This lobby action could not be completed. Check permissions, dates, capacity and whether joining is still open, then refresh.",
      );
    if (r.data && typeof r.data === "object" && "error" in r.data)
      throw new Error(
        r.data.error === "rate_limited"
          ? "Too many invitation attempts. Wait five minutes."
          : "This invitation is unavailable, revoked, expired or joining is closed.",
      );
    if (r.data !== null && typeof r.data !== "object")
      throw new Error("Invalid lobby response.");
    return r.data as T;
  }
  return {
    draw: async (id: string) => call<SantaLobby>("draw", id),
    getMySecretSantaAssignment: async (id: string) =>
      call<SantaAssignment>("assignment", id),
    reveal: async (id: string) => call<SantaAssignment>("reveal", id),
    get: async (id: string) => call<SantaLobby | SantaPreview>("get", id),
    create: async (
      name: string,
      settings: SantaConfig,
      requestId: string,
      groupId: string | null,
    ) =>
      call<SantaLobby>("create", null, {
        name: sessionName(name),
        settings: validateSantaSettings(settings),
        request_id: sessionId(requestId),
        group_id: groupId ? sessionId(groupId) : null,
      }),
    edit: async (id: string, name: string, settings: SantaConfig) =>
      call<SantaLobby>("edit", id, {
        name: sessionName(name),
        settings: validateSantaSettings(settings),
      }),
    preview: async (code: string) =>
      call<SantaPreview>("preview", null, { code: invitationCode(code) }),
    redeem: async (code: string) =>
      call<SantaLobby>("redeem", null, { code: invitationCode(code) }),
    join: async (id: string) => call<SantaLobby>("join", id),
    leave: async (id: string) => call<null>("leave", id),
    close: async (id: string) => call<SantaLobby>("close", id),
    cancel: async (id: string) => call<SantaLobby>("cancel", id),
    invite: async (id: string) => call<SessionInvite>("invite", id),
    revoke: async (id: string, inviteId: string) =>
      call<SantaLobby>("revoke", id, { invite_id: sessionId(inviteId) }),
    remove: async (id: string, userId: string) =>
      call<SantaLobby>("remove", id, { user_id: sessionId(userId) }),
    extend: async (id: string, deadline: string) =>
      call<SantaLobby>("extend", id, { joining_deadline: deadline }),
    groupLobbies: async (groupId: string) =>
      call<SantaPreview[]>("group_lobbies", null, {
        group_id: sessionId(groupId),
      }),
  };
}
export const santaService = createSantaService((action, id, data) =>
  requireSupabase().rpc("secret_santa_lobby", {
    p_action: action,
    p_session_id: id,
    p_data: data as never,
  }),
);
