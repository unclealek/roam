import type { GameDefinition } from "../games/types";
import type { SessionSummary } from "./types";
export function sessionActions(
  session: SessionSummary,
  actorId: string,
  game: GameDefinition | undefined,
) {
  const host = session.host_id === actorId;
  const editable = ["draft", "lobby"].includes(session.status);
  const supports = (op: GameDefinition["operations"][number]) =>
    game?.operations.includes(op) === true;
  return {
    edit: host && editable && Boolean(game),
    cancel:
      host &&
      ["draft", "lobby", "active"].includes(session.status) &&
      supports("cancel"),
    openLobby:
      host &&
      session.status === "draft" &&
      game?.metadata.availability_status === "available" &&
      supports("open_lobby"),
    start:
      host &&
      session.status === "lobby" &&
      game?.metadata.availability_status === "available" &&
      session.participant_count >= game.metadata.min_players &&
      (game.metadata.max_players === null ||
        session.participant_count <= game.metadata.max_players) &&
      supports("start"),
    leave: !host && editable && supports("leave"),
  };
}
export const statusLabels = {
  draft: "Draft",
  lobby: "In lobby",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
} as const;
