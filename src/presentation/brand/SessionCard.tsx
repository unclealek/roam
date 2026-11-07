import { Text, View, type ImageSourcePropType } from "react-native";
import { RoamIcon, resolveGameIcon, FunctionalIcon } from "../icons";
import { router } from "expo-router";
import type {
  SessionMember,
  SessionSummary,
} from "../../platform/sessions/types";
import { gameRegistry } from "../../platform/games/registry";
import { statusLabels } from "../../platform/sessions/permissions";
import { RoamCard } from "./ui";
import { PlayerAvatar } from "./PlayerAvatar";
import { useRoamTheme } from "./theme";
export function SessionCard({
  session,
  backgroundImage,
  participants = [],
}: {
  session: SessionSummary;
  backgroundImage?: ImageSourcePropType;
  participants?: readonly SessionMember[];
}) {
  const { colors, type } = useRoamTheme();
  const maxPlayers =
    typeof session.configuration.max_participants === "number"
      ? session.configuration.max_participants
      : gameRegistry.get(session.game_type_id)?.metadata.max_players;
  const participantProgress =
    maxPlayers && maxPlayers > 0
      ? Math.min(session.participant_count / maxPlayers, 1)
      : null;
  return (
    <RoamCard
      backgroundImage={backgroundImage}
      accessibilityLabel={`View session: ${session.name}`}
      accessibilityHint={`${statusLabels[session.status]}. ${session.participant_count} participants. Opens this game.`}
      onPress={() => router.push(`/session/${session.id}`)}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View
          style={{
            width: 56,
            height: 64,
            borderRadius: 16,
            backgroundColor: colors.surfaceElevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RoamIcon name={resolveGameIcon(session.game_type_id)} size={34} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {gameRegistry.get(session.game_type_id)?.metadata.name ??
              "Unavailable game"}{" "}
            · {statusLabels[session.status]}
          </Text>
          <Text style={[type.headline, { color: colors.textPrimary }]}>
            {session.name}
          </Text>
          <Text
            style={[
              type.caption,
              { color: colors.brandPrimary, fontWeight: "700" },
            ]}
          >
            {session.status === "active"
              ? "Continue playing"
              : session.status === "lobby"
                ? "Open lobby"
                : session.status === "draft"
                  ? "Continue setup"
                  : "View game"}
          </Text>
        </View>
        <FunctionalIcon
          accessible={false}
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </View>
      <View
        accessibilityLabel={`${session.participant_count} participants${participantProgress === null ? "" : `, ${Math.round(participantProgress * 100)}% of player capacity`}`}
        accessible
        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {participants.slice(0, 3).map((participant, index) => (
            <View
              key={participant.user_id}
              style={{
                marginLeft: index === 0 ? 0 : -8,
                borderWidth: 2,
                borderColor: colors.surface,
                borderRadius: 12,
              }}
            >
              <PlayerAvatar name={participant.display_name} size={28} />
            </View>
          ))}
        </View>
        <Text style={[type.caption, { color: colors.textSecondary, flex: 1 }]}>
          {session.participant_count}{" "}
          {session.participant_count === 1 ? "participant" : "participants"}
        </Text>
      </View>
      {participantProgress !== null ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Players joined"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(participantProgress * 100),
          }}
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${participantProgress * 100}%`,
              height: "100%",
              backgroundColor: colors.brandPrimary,
              borderRadius: 3,
            }}
          />
        </View>
      ) : null}
    </RoamCard>
  );
}
