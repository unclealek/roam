import type { SessionSummary } from "../../platform/sessions/types";
import { EmptyState } from "../brand/ui";
import { SessionCard } from "../brand/SessionCard";
export function MyGames({ sessions }: { sessions: readonly SessionSummary[] }) {
  if (!sessions.length)
    return (
      <EmptyState
        title="No games yet"
        illustration="empty-games"
        message="Start a game or join with a code."
      />
    );
  return (
    <>
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </>
  );
}
