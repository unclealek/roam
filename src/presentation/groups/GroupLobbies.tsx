import { useCallback } from "react";
import { router } from "expo-router";
import { santaService } from "../../games/secret-santa/service";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import {
  Body,
  ErrorState,
  Loading,
  RoamButton,
  RoamCard,
  SectionHeading,
} from "../brand/ui";
export function SantaGroupLobbies({ groupId }: { groupId: string }) {
  const load = useCallback(() => santaService.groupLobbies(groupId), [groupId]);
  const resource = useAccountResource(load);
  return (
    <RoamCard>
      <SectionHeading>Open gift exchanges</SectionHeading>
      <Body>Join an exchange to take part.</Body>
      {resource.loading ? <Loading /> : null}
      {resource.error ? (
        <ErrorState message={resource.error} retry={resource.refresh} />
      ) : null}
      {Array.isArray(resource.data)
        ? resource.data.map((lobby) => (
            <RoamButton
              secondary
              key={lobby.id}
              label={`Open gift exchange: ${lobby.name}`}
              onPress={() =>
                router.push(`/game/secret_santa/lobby/${lobby.id}`)
              }
            />
          ))
        : null}
      {resource.data?.length === 0 ? <Body>No open exchanges.</Body> : null}
    </RoamCard>
  );
}
