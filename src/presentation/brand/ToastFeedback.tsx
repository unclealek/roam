import { foregroundPresentationSuppressed } from "../../platform/notifications/presentation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { FunctionalIcon } from "../icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
} from "react-native-reanimated";
import { motion, useRoamTheme } from "./theme";
export { isCriticalFeedbackRoute } from "./feedback-policy";
export type FeedbackItem = {
  id: string;
  message: string;
  kind?: "success" | "error" | "activity";
};
const Context = createContext<{ show: (item: FeedbackItem) => void } | null>(
  null,
);
export function useFeedback() {
  return useContext(Context);
}
/** Scoped by account at the app root; one visible notice, bounded deduplication. */
export function FeedbackProvider({
  children,
  suppressActivity = false,
}: {
  children: ReactNode;
  suppressActivity?: boolean;
}) {
  const { colors, type, radius } = useRoamTheme();
  const [item, setItem] = useState<FeedbackItem | null>(null);
  const seen = useRef(new Map<string, number>());
  const show = useCallback(
    (next: FeedbackItem) => {
      if (
        next.kind === "activity" &&
        (suppressActivity || foregroundPresentationSuppressed())
      )
        return;
      const now = Date.now();
      if (now - (seen.current.get(next.id) ?? -Infinity) < 30000) return;
      seen.current.set(next.id, now);
      if (seen.current.size > 128)
        seen.current.delete(seen.current.keys().next().value!);
      setItem(next);
    },
    [suppressActivity],
  );
  useEffect(() => {
    if (!item) return;
    if (Platform.OS === "ios")
      AccessibilityInfo.announceForAccessibility(item.message);
    const timer = setTimeout(() => setItem(null), motion.feedbackTimeout);
    return () => clearTimeout(timer);
  }, [item]);
  return (
    <Context.Provider value={{ show }}>
      {item && !(suppressActivity && item.kind === "activity") ? (
        <View
          pointerEvents="box-none"
          style={{
            flexShrink: 0,
            backgroundColor: colors.background,
          }}
        >
          <SafeAreaView
            pointerEvents="box-none"
            edges={["top", "left", "right"]}
          >
            <Animated.View
              key={item.id}
              entering={FadeIn.duration(motion.entrance).reduceMotion(
                ReduceMotion.System,
              )}
              exiting={FadeOut.duration(motion.press).reduceMotion(
                ReduceMotion.System,
              )}
              style={{ paddingHorizontal: 16, paddingTop: 8 }}
            >
              <View
                style={{
                  maxWidth: 640,
                  width: "100%",
                  alignSelf: "center",
                  backgroundColor: colors.surface,
                  borderColor:
                    item.kind === "error" ? colors.error : colors.border,
                  borderWidth: 1,
                  borderRadius: radius.control,
                  padding: 16,
                  gap: 12,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text
                  accessibilityLiveRegion="polite"
                  role="status"
                  style={[type.callout, { color: colors.textPrimary, flex: 1 }]}
                >
                  {item.message}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss feedback"
                  onPress={() => setItem(null)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FunctionalIcon
                    accessible={false}
                    name="close"
                    size={22}
                    color={colors.textPrimary}
                  />
                </Pressable>
              </View>
            </Animated.View>
          </SafeAreaView>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
    </Context.Provider>
  );
}
/** Inline fallback keeps isolated screens useful without a global host. */
export function FeedbackNotice({
  message,
  id,
}: {
  message: string;
  id?: string;
}) {
  const eventId = useId();
  const noticeId = id ?? eventId;
  const show = useFeedback()?.show;
  const { colors, type } = useRoamTheme();
  useEffect(() => {
    if (message) show?.({ id: noticeId, message });
  }, [show, noticeId, message]);
  return show ? null : (
    <Text
      accessibilityLiveRegion="polite"
      style={[type.body, { color: colors.textPrimary }]}
    >
      {message}
    </Text>
  );
}
