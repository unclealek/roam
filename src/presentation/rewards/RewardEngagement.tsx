import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Platform,
  Text,
  View,
} from "react-native";
import { RoamIcon, resolveAchievementIcon } from "../icons";
import type { RewardDashboard } from "../../platform/rewards/types";
import type { RewardNotice } from "../../platform/rewards/presentation";
import { rewardAcknowledgments } from "../../platform/rewards/acknowledgment-storage";
import { RoamBackground } from "../brand/RoamBackground";
import { RoamMascot } from "../brand/RoamMascot";
import { Body, Button } from "../brand/forms";
import { useRoamTheme } from "../brand/theme";
import { successFeedback } from "../brand/feedback";
import { suspendForegroundPresentation } from "../../platform/notifications/presentation";
import { CardArtwork } from "./CardArtwork";
import { RewardMotion } from "./RewardMotion";

/** Only call with a successfully fetched server dashboard. No client award operation. */
export function useRewardEngagement(
  userId: string | undefined,
  data: RewardDashboard | null,
) {
  const [state, setState] = useState<{
    userId: string | undefined;
    items: RewardNotice[];
  }>({ userId, items: [] });
  const focused = useRef(true);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        setState((previous) => ({ ...previous, items: [] }));
      };
    }, []),
  );
  useEffect(() => {
    if (!data || !userId) return;
    let active = true;
    void rewardAcknowledgments.observe(userId, data).then((items) => {
      if (!active || !focused.current || !items.length) return;
      setState((previous) => ({
        userId,
        items: [
          ...(previous.userId === userId ? previous.items : []),
          ...items,
        ].filter(
          (item, index, all) =>
            all.findIndex((other) => other.key === item.key) === index,
        ),
      }));
      successFeedback();
      if (Platform.OS !== "web")
        AccessibilityInfo.announceForAccessibility(
          items.map((item) => item.text).join(". "),
        );
    });
    return () => {
      active = false;
    };
  }, [data, userId]);
  return {
    items: state.userId === userId ? state.items : [],
    dismiss: (key: string) =>
      setState((previous) => ({
        ...previous,
        items: previous.items.filter((item) => item.key !== key),
      })),
  };
}
export function RewardCelebration({
  notice,
  data,
  onDismiss,
}: {
  notice: RewardNotice;
  data: RewardDashboard;
  onDismiss: () => void;
}) {
  const { colors, type } = useRoamTheme();
  const [revealed, setRevealed] = useState(false);
  const [active, setActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    if (notice.kind !== "xp") return;
    const timer = setTimeout(() => dismiss.current(), 5000);
    return () => clearTimeout(timer);
  }, [notice.key, notice.kind]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => listener.remove();
  }, []);
  useEffect(
    () =>
      active && notice.kind !== "xp"
        ? suspendForegroundPresentation()
        : undefined,
    [active, notice.kind],
  );
  const card = data.collectibles.find(
    (card) => `card:${card.id}` === notice.key,
  );
  const achievement = data.achievements.find(
    (item) => `achievement:${item.earned_id}` === notice.key,
  );
  if (!active) return null;
  const major = notice.kind === "level";
  return (
    <RewardMotion>
      <View style={{ borderRadius: 28, overflow: "hidden" }}>
        <RoamBackground variant={major ? "celebration" : "elevated"}>
          <View
            accessibilityLiveRegion="polite"
            style={{ padding: 20, gap: 12 }}
          >
            <RoamIcon
              name={
                major
                  ? "levels"
                  : notice.kind === "xp"
                    ? "points"
                    : resolveAchievementIcon(achievement?.id ?? "achievement")
              }
              size={40}
              theme="brand"
              badge={notice.kind === "achievement"}
            />
            <Text
              accessibilityRole="header"
              style={[
                major ? type.title1 : type.headline,
                { color: colors.textPrimary },
              ]}
            >
              {notice.text}
            </Text>
            {major ? (
              <RoamMascot placement="small" size={120} state="celebrating" />
            ) : null}
            {achievement ? (
              <>
                <RoamMascot placement="small" size={96} state="happy" />
                <Body>{achievement.description}</Body>
              </>
            ) : null}
            {card ? (
              <>
                {revealed ? (
                  <RewardMotion>
                    <CardArtwork
                      artworkKey={card.artwork_key}
                      rarity={card.rarity}
                    />
                  </RewardMotion>
                ) : (
                  <CardArtwork
                    artworkKey={card.artwork_key}
                    rarity={card.rarity}
                    locked
                  />
                )}
                <Body>
                  {card.rarity} · {card.description}
                </Body>
                {!revealed ? (
                  <Button
                    label={`Reveal ${card.name}`}
                    onPress={() => setRevealed(true)}
                  />
                ) : null}
              </>
            ) : null}
            <Button
              label={notice.kind === "xp" ? "Done" : "Continue"}
              variant={major ? "primary" : "ghost"}
              size="small"
              onPress={onDismiss}
            />
          </View>
        </RoamBackground>
      </View>
    </RewardMotion>
  );
}
