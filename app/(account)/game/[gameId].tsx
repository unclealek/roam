import {
  SantaMoment,
  SantaHowItWorks,
} from "../../../src/presentation/secret-santa/SantaExperience";
import { router, useLocalSearchParams } from "expo-router";
import { gameRegistry } from "../../../src/platform/games/registry";
import {
  Body,
  Button,
  EmptyState,
  Screen,
} from "../../../src/presentation/brand/forms";
export default function GameDetails() {
  const { gameId, groupId } = useLocalSearchParams<{
    gameId: string;
    groupId?: string;
  }>();
  const game =
    typeof gameId === "string" ? gameRegistry.get(gameId) : undefined;
  return (
    <Screen title={game?.metadata.name ?? "Game unavailable"} backTo="/games">
      {game ? (
        <>
          <Body>
            {game.metadata.category} ·{" "}
            {game.metadata.availability_status === "available"
              ? "Available now"
              : "Coming soon"}
          </Body>
          <Body>{game.metadata.description}</Body>
          <Body>
            {game.metadata.max_players === null
              ? `${game.metadata.min_players}+ players`
              : `${game.metadata.min_players}–${game.metadata.max_players} players`}
          </Body>
          {game.metadata.availability_status === "available" &&
          game.routes.experience ? (
            <>
              <Button
                label="Create Secret Santa"
                onPress={() =>
                  router.push(
                    (game.routes.experience +
                      (typeof groupId === "string"
                        ? `?groupId=${encodeURIComponent(groupId)}`
                        : "")) as never,
                  )
                }
              />
              <Button
                label="Join a Game"
                onPress={() => router.push("/game/secret_santa/join" as never)}
              />
              <Body>Invite friends to exchange gifts.</Body>
            </>
          ) : (
            <EmptyState
              title="Coming soon"
              message={`${game.metadata.name} is coming soon.`}
            />
          )}
        </>
      ) : (
        <EmptyState title="Choose another game" />
      )}
      {gameId === "secret_santa" ? (
        <>
          <SantaMoment kind="welcome" />
          <SantaHowItWorks />
        </>
      ) : null}
      <Button
        label="Back to Games"
        onPress={() =>
          router.replace(
            typeof groupId === "string"
              ? { pathname: "/games", params: { groupId } }
              : "/games",
          )
        }
      />
    </Screen>
  );
}
