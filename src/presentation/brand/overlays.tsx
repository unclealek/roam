import { FunctionalIcon } from "../icons";
import { suspendForegroundPresentation } from "../../platform/notifications/presentation";
import {
  useRef,
  useEffect,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { RoamButton } from "./RoamButton";
import { useRoamTheme } from "./theme";
function focusHeading(ref: RefObject<ComponentRef<typeof Text> | null>) {
  if (Platform.OS === "web") {
    const element = ref.current as unknown as {
      focus?: () => void;
      setAttribute?: (name: string, value: string) => void;
    };
    element?.setAttribute?.("tabindex", "-1");
    element?.focus?.();
  } else {
    const node = findNodeHandle(ref.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }
}
export type DialogKind =
  "information" | "confirmation" | "destructive" | "success" | "error";
export function RoamDialog({
  visible,
  title,
  message,
  kind = "confirmation",
  busy = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  children,
  error,
  confirmDisabled = false,
}: {
  visible: boolean;
  title: string;
  message: string;
  kind?: DialogKind;
  busy?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: ReactNode;
  error?: string;
  confirmDisabled?: boolean;
}) {
  const { colors, type, radius } = useRoamTheme();
  useEffect(
    () => (visible ? suspendForegroundPresentation() : undefined),
    [visible],
  );
  const reduced = useReducedMotion();
  const headingRef = useRef<ComponentRef<typeof Text>>(null);
  const cancel = () => {
    if (!busy) onCancel();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "fade"}
      onShow={() => focusHeading(headingRef)}
      onRequestClose={() => {
        if (kind !== "destructive") cancel();
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: "rgba(8,27,88,0.45)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          >
            <View
              role="alertdialog"
              accessibilityViewIsModal
              accessibilityLabel={title}
              style={{
                alignSelf: "center",
                width: "100%",
                maxWidth: 480,
                padding: 24,
                gap: 18,
                borderRadius: radius.card,
                backgroundColor: colors.surface,
              }}
            >
              <FunctionalIcon
                accessible={false}
                name={
                  kind === "success"
                    ? "checkmark-circle-outline"
                    : kind === "error" || kind === "destructive"
                      ? "alert-circle-outline"
                      : "information-circle-outline"
                }
                size={32}
                color={
                  kind === "success"
                    ? colors.success
                    : kind === "error" || kind === "destructive"
                      ? colors.error
                      : colors.brandPrimary
                }
              />
              <Text
                ref={headingRef}
                accessibilityRole="header"
                style={[type.title2, { color: colors.textPrimary }]}
              >
                {title}
              </Text>
              <Text style={[type.body, { color: colors.textSecondary }]}>
                {message}
              </Text>
              {children}
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={[type.body, { color: colors.error }]}
                >
                  {error}
                </Text>
              ) : null}
              <RoamButton
                label={confirmLabel}
                variant={kind === "destructive" ? "destructive" : "primary"}
                loading={busy}
                disabled={confirmDisabled}
                onPress={onConfirm}
              />
              <RoamButton
                label={cancelLabel}
                variant="ghost"
                disabled={busy}
                onPress={cancel}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function RoamSheet({
  visible,
  title,
  children,
  onClose,
  busy = false,
  closeLabel = "Close sheet",
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  closeLabel?: string;
}) {
  const { colors, type, radius } = useRoamTheme();
  useEffect(
    () => (visible ? suspendForegroundPresentation() : undefined),
    [visible],
  );
  const reduced = useReducedMotion();
  const headingRef = useRef<ComponentRef<typeof Text>>(null);
  const close = () => {
    if (!busy) onClose();
  };
  const native = Platform.OS === "ios";
  return (
    <Modal
      visible={visible}
      transparent={!native}
      presentationStyle={native ? "pageSheet" : "overFullScreen"}
      allowSwipeDismissal={!busy}
      animationType={reduced ? "none" : "slide"}
      onRequestClose={close}
      onShow={() => focusHeading(headingRef)}
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: native ? colors.surface : "rgba(8,27,88,0.45)",
        }}
        behavior={native ? "padding" : undefined}
      >
        <SafeAreaView
          style={{
            flex: native ? 1 : undefined,
            maxHeight: native ? "100%" : "90%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 24,
              gap: 18,
              width: "100%",
              maxWidth: 680,
              alignSelf: "center",
            }}
          >
            <View
              role="dialog"
              accessibilityViewIsModal
              accessibilityLabel={title}
              style={{ gap: 18 }}
            >
              <Text
                ref={headingRef}
                accessibilityRole="header"
                style={[type.title2, { color: colors.textPrimary }]}
              >
                {title}
              </Text>
              {children}
              <RoamButton
                label={closeLabel}
                variant="ghost"
                disabled={busy}
                onPress={close}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
