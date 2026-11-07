import { requireSupabase } from "../supabase";
import type { Database } from "../database.types";
import { gameRegistry, type GameRegistry } from "../games/registry";
import {
  readSession,
  readSessionDetails,
  sessionId,
  sessionName,
} from "./validation";
type Functions = Database["public"]["Functions"];
export type SessionRpc = Exclude<keyof Functions, "delete_own_account">;
export type SessionInvoker = <N extends SessionRpc>(
  name: N,
  args: Functions[N]["Args"],
) => PromiseLike<{ data: unknown; error: unknown }>;
export function createSessionService(
  invoke: SessionInvoker,
  registry: GameRegistry = gameRegistry,
) {
  async function call<N extends SessionRpc>(
    name: N,
    args: Functions[N]["Args"],
  ) {
    const { data, error } = await invoke(name, args);
    if (error)
      throw new Error(
        "Unable to complete this session request. Check your connection and permissions, then retry.",
      );
    return data;
  }
  const mutate = async (
    name:
      | "join_game_session"
      | "start_game_session"
      | "cancel_game_session"
      | "open_game_lobby",
    id: string,
  ) => readSession(await call(name, { p_session_id: sessionId(id) }));
  return {
    async create(input: {
      gameTypeId: string;
      name: string;
      configuration: unknown;
      requestId: string;
      groupId?: string;
    }) {
      const module = registry.require(input.gameTypeId);
      if (
        module.metadata.availability_status !== "available" ||
        !module.operations.includes("create")
      )
        throw new Error("This game is coming soon or unavailable.");
      if (module.routes.experience)
        throw new Error(
          "Use this game’s dedicated setup screen to configure its session.",
        );
      const config = module.validateConfiguration(input.configuration);
      return readSession(
        await call(
          input.groupId ? "create_group_game_session" : "create_game_session",
          {
            ...(input.groupId ? { p_group_id: sessionId(input.groupId) } : {}),
            p_game_type_id: module.id,
            p_name: sessionName(input.name),
            p_configuration: config,
            p_request_id: sessionId(input.requestId),
          },
        ),
      );
    },
    async get(id: string) {
      return readSessionDetails(
        await call("get_game_session", { p_session_id: sessionId(id) }),
      );
    },
    async list() {
      const data = await call("list_my_game_sessions", {});
      if (!Array.isArray(data))
        throw new Error("Invalid session list response.");
      return data.map(readSession);
    },
    async update(input: {
      sessionId: string;
      gameTypeId: string;
      name: string;
      configuration: unknown;
    }) {
      // The server reads the actual game type from the locked session; this id only selects a local validator.
      const config = registry
        .require(input.gameTypeId)
        .validateConfiguration(input.configuration);
      return readSession(
        await call("update_game_session", {
          p_session_id: sessionId(input.sessionId),
          p_name: sessionName(input.name),
          p_configuration: config,
        }),
      );
    },
    join: (id: string) => mutate("join_game_session", id),
    start: (id: string) => mutate("start_game_session", id),
    cancel: (id: string) => mutate("cancel_game_session", id),
    openLobby: (id: string) => mutate("open_game_lobby", id),
    async leave(id: string) {
      await call("leave_game_session", { p_session_id: sessionId(id) });
    },
  };
}
export const sessionService = createSessionService((name, args) =>
  requireSupabase().rpc(name, args),
);
