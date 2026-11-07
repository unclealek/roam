import { rewardHint } from "../copy";
import { useCallback } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import { getCard } from "../../platform/rewards/service";
import {
  Body,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Panel,
  Screen,
} from "../brand/forms";
import { RoamMascot } from "../brand/RoamMascot";
import { CardArtwork, useCardStyles } from "./CardArtwork";
export default function CardDetailScreen() {
  const cardStyles = useCardStyles();
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  const load = useCallback(
    () => getCard(typeof cardId === "string" ? cardId : ""),
    [cardId],
  );
  const resource = useAccountResource(load);
  const card = resource.data;
  return (
    <Screen title={card?.name ?? "Collectible card"} backTo="/rewards">
      <Button
        label="Back to rewards"
        onPress={() => router.dismissTo("/rewards")}
      />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.refresh} />
      ) : card ? (
        <>
          <CardArtwork
            artworkKey={card.artwork_key}
            rarity={card.rarity}
            locked={!card.unlocked_at}
          />
          <Panel>
            <Text style={cardStyles.rarity}>{card.rarity}</Text>
            <Body>{card.description}</Body>
            <RoamMascot
              placement="small"
              size={120}
              state={card.unlocked_at ? "happy" : "curious"}
            />
            {card.game_type_id ? (
              <Body>Game: {card.game_type_id.replaceAll("_", " ")}</Body>
            ) : null}
            <Text style={cardStyles.heading}>How to collect</Text>
            <Body>
              {rewardHint(
                card.id,
                card.unlock_rule.description ?? "Play to unlock this card.",
              )}
            </Body>
            <Body>
              {card.unlocked_at
                ? `Earned ${new Date(card.unlocked_at).toLocaleDateString()}`
                : "Locked"}
            </Body>
          </Panel>
        </>
      ) : (
        <EmptyState
          title="Card not found"
          message="This card is unavailable."
        />
      )}
    </Screen>
  );
}
