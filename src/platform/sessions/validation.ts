import {
  sessionStatuses,
  type SessionSummary,
  type SessionDetails,
} from "./types";
export function sessionId(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("Invalid session identifier.");
  return value;
}
export function sessionName(value: string): string {
  const name = value.trim();
  if (!name || [...name].length > 120 || /[\u0000-\u001f\u007f]/u.test(name))
    throw new Error(
      "Use a session name with 1–120 characters and no line breaks.",
    );
  return name;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function readSession(value: unknown): SessionSummary {
  if (
    !record(value) ||
    !["id", "game_type_id", "host_id", "name", "created_at"].every(
      (key) => typeof value[key] === "string",
    ) ||
    (value.group_id !== null &&
      (typeof value.group_id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(value.group_id))) ||
    !record(value.configuration) ||
    !sessionStatuses.includes(value.status as never) ||
    !Number.isSafeInteger(value.participant_count) ||
    (value.participant_count as number) < 1 ||
    ![value.started_at, value.completed_at].every(
      (date) => date === null || typeof date === "string",
    )
  )
    throw new Error("Invalid session response.");
  return value as unknown as SessionSummary;
}
export function readSessionDetails(value: unknown): SessionDetails {
  const summary = readSession(value);
  if (
    !record(value) ||
    !record(value.host) ||
    typeof value.host.id !== "string" ||
    typeof value.host.display_name !== "string" ||
    !Array.isArray(value.participants) ||
    !value.participants.every(
      (member) =>
        record(member) &&
        ["id", "user_id", "display_name", "joined_at"].every(
          (key) => typeof member[key] === "string",
        ) &&
        ["host", "member"].includes(member.role as string),
    )
  )
    throw new Error("Invalid session details response.");
  return {
    ...summary,
    host: value.host,
    participants: value.participants,
  } as SessionDetails;
}
