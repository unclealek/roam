import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
export function selectionFeedback() {
  if (Platform.OS !== "web")
    void Haptics.selectionAsync().catch(() => undefined);
}

export function successFeedback() {
  if (Platform.OS !== "web")
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => undefined);
}
