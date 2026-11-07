import { GroupSymbol } from "../icons/GroupSymbol";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { FunctionalIcon } from "../icons";
import { PlayerAvatar } from "./PlayerAvatar";
import type { Group, GroupDetails } from "../../platform/groups/types";
import { RoamCard } from "./ui";
import { useRoamTheme } from "./theme";
import type { ComponentProps } from "react";
import groupPuzzle from "../../../assets/groups-puzzle.jpg";

export function GroupCardSurface(
  props: Omit<
    ComponentProps<typeof RoamCard>,
    "backgroundImage" | "backgroundImageOpacity"
  >,
) {
  return (
    <RoamCard
      {...props}
      backgroundImage={groupPuzzle}
      backgroundImageOpacity={0.16}
    />
  );
}

export function GroupCard({
  group,
  details,
}: {
  group: Group;
  details?: GroupDetails;
}) {
  const { colors, type } = useRoamTheme();
  return (
    <GroupCardSurface
      onPress={() => router.push(`/group/${group.id}`)}
      accessibilityLabel={`Open group: ${group.name}`}
      accessibilityHint={`${group.member_count} members. Opens group details.`}
    >
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.actionPrimary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...type.headline, color: colors.onAction }}>
            {group.name
              .split(/\s+/)
              .map((word) => word[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </Text>
          <View
            style={{
              position: "absolute",
              right: -5,
              bottom: -5,
              padding: 3,
              borderRadius: 10,
              backgroundColor: colors.surface,
            }}
          >
            <GroupSymbol iconKey={group.icon_key} size={16} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.headline, { color: colors.textPrimary }]}>
            {group.name}
          </Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>
            {group.member_count}{" "}
            {group.member_count === 1 ? "member" : "members"}
          </Text>
        </View>
        <FunctionalIcon
          accessible={false}
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </View>

      {details ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {details.members.slice(0, 4).map((member) => (
              <PlayerAvatar
                key={member.user_id}
                name={member.display_name}
                size={36}
              />
            ))}
          </View>
          <Text style={[type.callout, { color: colors.textSecondary }]}>
            {
              details.sessions.filter((session) =>
                ["draft", "lobby", "active"].includes(session.status),
              ).length
            }{" "}
            active games
          </Text>
        </>
      ) : null}
    </GroupCardSurface>
  );
}
