import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { GroupPickerSheet } from "../../src/presentation/groups/GroupPickerSheet";
import { loadCatalog } from "../../src/platform/games/service";
import { sessionService } from "../../src/platform/sessions/service";
import { useAccountResource } from "../../src/platform/sessions/useAccountResource";
import { GameCard } from "../../src/presentation/games/GameCard";
import { MyGames } from "../../src/presentation/games/MyGames";
import {
  RoamScreen,
  RoamHeader,
  SectionHeading,
  EmptyState,
  ErrorState,
  Loading,
} from "../../src/presentation/brand/ui";
export default function GamesScreen() {
  const [picking, setPicking] = useState(false);
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId =
    typeof params.groupId === "string" ? params.groupId : undefined;
  const catalog = useAccountResource(loadCatalog);
  const sessions = useAccountResource(sessionService.list);
  return (
    <RoamScreen>
      <RoamHeader
        title="What shall we play?"
        actionLabel="Choose group"
        icon="people-outline"
        action={() => setPicking(true)}
        subtitle={
          groupId ? "Choose a game to play with your group." : undefined
        }
      />
      {picking ? (
        <GroupPickerSheet
          onClose={() => setPicking(false)}
          onSelect={(id) => {
            router.setParams({ groupId: id });
            setPicking(false);
          }}
        />
      ) : null}
      <SectionHeading>Available games</SectionHeading>
      {catalog.loading ? <Loading label="Loading games…" /> : null}
      {catalog.error ? (
        <ErrorState message={catalog.error} retry={catalog.refresh} />
      ) : null}
      {catalog.data?.map((game) => (
        <GameCard key={game.definition.id} game={game} groupId={groupId} />
      ))}
      {catalog.data?.length === 0 ? (
        <EmptyState title="No games yet" message="Check back soon." />
      ) : null}
      <SectionHeading>My games</SectionHeading>
      {sessions.loading ? <Loading label="Loading games…" /> : null}
      {sessions.error ? (
        <ErrorState message={sessions.error} retry={sessions.refresh} />
      ) : null}
      {sessions.data ? <MyGames sessions={sessions.data} /> : null}
    </RoamScreen>
  );
}
