import { rewardHint } from "../copy";
import { useState } from "react";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../platform/auth/AuthProvider";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import {
  getRewardDashboard,
  getRewardHistory,
} from "../../platform/rewards/service";
import { eventLabels } from "../../platform/rewards/presentation";
import type { XpTransaction, PlayerCard } from "../../platform/rewards/types";
import { Body, Button, ErrorState, Loading, Panel } from "../brand/forms";
import { RoamScreen, RoamHeader } from "../brand/ui";
import { useRoamTheme } from "../brand/theme";
import { CardArtwork, useCardStyles } from "./CardArtwork";
import { RewardCelebration, useRewardEngagement } from "./RewardEngagement";
import { AchievementBadge, resolveAchievementIcon } from "../icons";
import { useResumeRefresh } from "../brand/useResumeRefresh";
import rewardTrophy from "../../../assets/reward-trophy.jpg";
function History({
  initial,
  collectibles,
}: {
  initial: XpTransaction[];
  collectibles: PlayerCard[];
}) {
  const styles = useRewardStyles();
  const cardStyles = useCardStyles();
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(initial.length === 30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const load = async () => {
    setBusy(true);
    setError(false);
    try {
      const page = await getRewardHistory(items.at(-1));
      setItems((previous) => [...previous, ...page]);
      setMore(page.length === 30);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel>
      <Text style={cardStyles.heading}>Reward history</Text>
      {collectibles
        .filter((card) => card.unlocked_at)
        .sort((a, b) => b.unlocked_at!.localeCompare(a.unlocked_at!))
        .slice(0, 5)
        .map((card) => (
          <View key={card.owned_id || card.id} style={styles.historyRow}>
            <View style={styles.historyText}>
              <Body>Collected {card.name}</Body>
              <Text style={cardStyles.label}>
                {new Date(card.unlocked_at!).toLocaleDateString()}
              </Text>
            </View>
            <Text style={cardStyles.rarity}>{card.rarity}</Text>
          </View>
        ))}
      {items.length ? (
        items.map((item) => (
          <View key={item.id} style={styles.historyRow}>
            <View style={styles.historyText}>
              <Body>{eventLabels[item.source_event_key] ?? "Game reward"}</Body>
              <Text style={cardStyles.label}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.xpAmount}>+{item.amount} XP</Text>
          </View>
        ))
      ) : (
        <Body>Play to earn XP.</Body>
      )}
      {error ? (
        <ErrorState
          message="Unable to load more rewards."
          retry={() => void load()}
        />
      ) : null}
      {more ? (
        <Button
          label={busy ? "Loading…" : "Load more rewards"}
          disabled={busy}
          onPress={() => void load()}
        />
      ) : null}
    </Panel>
  );
}
export default function RewardsScreen() {
  const { colors } = useRoamTheme();
  const styles = useRewardStyles();
  const cardStyles = useCardStyles();
  const [collectionFilter, setCollectionFilter] = useState<
    "all" | "collected" | "locked"
  >("all");
  const userId = useAuth().session?.user.id;
  const resource = useAccountResource(getRewardDashboard, {
    retainOnRefresh: true,
  });
  useResumeRefresh(resource.refresh);
  const engagement = useRewardEngagement(
    userId,
    resource.loading || resource.error ? null : resource.data,
  );
  const data = resource.data;
  return (
    <RoamScreen refreshing={resource.refreshing} onRefresh={resource.refresh}>
      <RoamHeader title="Rewards" />

      {resource.loading ? (
        <Loading label="Loading your rewards…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.refresh} />
      ) : data ? (
        <>
          {engagement.items.map((notice) => (
            <RewardCelebration
              key={notice.key}
              notice={notice}
              data={data}
              onDismiss={() => engagement.dismiss(notice.key)}
            />
          ))}
          <ImageBackground
            source={rewardTrophy}
            resizeMode="cover"
            imageStyle={{ opacity: 0.72 }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              padding: 24,
              gap: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope",
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              Total XP
            </Text>
            <View style={styles.levelRow}>
              <Text
                style={{
                  fontFamily: "Manrope",
                  fontSize: 36,
                  fontWeight: "700",
                  color: colors.textPrimary,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {data.progress.total_xp.toLocaleString()} XP
              </Text>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: "Manrope",
                  color: colors.textSecondary,
                  fontWeight: "700",
                }}
              >
                Level {data.progress.level}
              </Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Progress to next level"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(data.progress.progress * 100),
              }}
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.border,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  borderRadius: 4,
                  backgroundColor: colors.brandPrimary,
                  width: `${Math.min(100, Math.max(0, data.progress.progress * 100))}%`,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: "Manrope",
                fontSize: 13,
                lineHeight: 20,
                color: colors.textSecondary,
              }}
            >
              {data.progress.xp_to_next_level === null
                ? "You’ve reached the highest current level. Your XP keeps growing."
                : `${data.progress.xp_to_next_level.toLocaleString()} XP to level ${data.progress.level + 1}`}
            </Text>
          </ImageBackground>
          <Button
            variant="ghost"
            size="small"
            label="Refresh rewards"
            onPress={resource.refresh}
          />
          {data.game_progress.length ? (
            <Panel>
              <Text style={cardStyles.heading}>Across your games</Text>
              {data.game_progress.map((game) => (
                <View key={game.game_type_id} style={styles.levelRow}>
                  <Body>{game.game_name}</Body>
                  <Text style={styles.xpAmount}>
                    {game.total_xp.toLocaleString()} XP
                  </Text>
                </View>
              ))}
              <Text style={cardStyles.label}></Text>
            </Panel>
          ) : null}
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={cardStyles.heading}>
              Your collection
            </Text>
            <Body>
              {data.collectibles.filter((c) => c.unlocked_at).length} /{" "}
              {data.collectibles.length}
            </Body>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                ["all", "All cards"],
                ["collected", "Collected cards"],
                ["locked", "Locked cards"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                label={`${collectionFilter === value ? "Selected: " : ""}${label}`}
                size="small"
                variant={collectionFilter === value ? "primary" : "outline"}
                onPress={() => setCollectionFilter(value)}
              />
            ))}
          </View>
          {collectionFilter === "collected" &&
          !data.collectibles.some((card) => card.unlocked_at) ? (
            <Body>No cards collected yet.</Body>
          ) : null}
          <View style={styles.cards}>
            {data.collectibles
              .filter(
                (card) =>
                  collectionFilter === "all" ||
                  (collectionFilter === "collected"
                    ? !!card.unlocked_at
                    : !card.unlocked_at),
              )
              .map((card) => (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${card.name} card, ${card.unlocked_at ? "unlocked" : "locked"}`}
                  onPress={() =>
                    router.push({
                      pathname: "/collectible/[cardId]",
                      params: { cardId: card.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <CardArtwork
                    artworkKey={card.artwork_key}
                    rarity={card.rarity}
                    locked={!card.unlocked_at}
                  />
                  <Text style={cardStyles.rarity}>{card.rarity}</Text>
                  <Text style={styles.cardName}>{card.name}</Text>
                  <Text style={cardStyles.label}>
                    {card.unlocked_at
                      ? `Collected ${new Date(card.unlocked_at).toLocaleDateString()}`
                      : "Locked"}
                  </Text>
                </Pressable>
              ))}
          </View>
          <Panel>
            <Text accessibilityRole="header" style={cardStyles.heading}>
              Achievements
            </Text>
            {data.achievements.length === 0 ? (
              <Body>Play to earn achievements.</Body>
            ) : null}
            {[...data.achievements]
              .sort((a, b) =>
                (b.unlocked_at || "").localeCompare(a.unlocked_at || ""),
              )
              .map((a) => (
                <Pressable
                  key={a.earned_id || a.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${a.name} achievement, ${a.earned_id ? "unlocked" : "locked"}`}
                  onPress={() =>
                    router.push(
                      `/achievement/${encodeURIComponent(a.id)}` as never,
                    )
                  }
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    gap: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <AchievementBadge
                      name={resolveAchievementIcon(a.id)}
                      state={a.earned_id ? "unlocked" : "locked"}
                      size={48}
                    />
                    <Text style={styles.cardName}>{a.name}</Text>
                  </View>
                  <Body>{rewardHint(a.id, a.description)}</Body>
                  <Text style={cardStyles.label}>
                    {a.unlocked_at
                      ? `Earned ${new Date(a.unlocked_at).toLocaleDateString()}`
                      : "Locked"}
                  </Text>
                </Pressable>
              ))}
          </Panel>
          <History
            key={`${userId}:${data.history[0]?.id ?? "empty"}`}
            initial={data.history}
            collectibles={data.collectibles}
          />
        </>
      ) : null}
    </RoamScreen>
  );
}
function useRewardStyles() {
  const { colors, type, radius, space } = useRoamTheme();
  return StyleSheet.create({
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
      color: colors.textSecondary,
    },
    levelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
    },
    level: {
      ...type.largeTitle,
      color: colors.textPrimary,
    },
    totalXp: { ...type.title2, color: colors.brandPrimary },
    track: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.paleBlue,
      overflow: "hidden",
    },
    fill: { height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cards: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    card: {
      width: "48%",
      flexGrow: 1,
      minWidth: 140,
      padding: space.md,
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: radius.control,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardName: {
      ...type.body,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    lockedAchievement: {
      ...type.caption,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    historyText: { flex: 1 },
    xpAmount: {
      ...type.caption,
      fontWeight: "700",
      color: colors.brandPrimary,
    },
  });
}
