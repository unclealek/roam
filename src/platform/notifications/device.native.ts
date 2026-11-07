import * as Notifications from "expo-notifications";
import { IosAuthorizationStatus, AndroidImportance } from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform, AppState } from "react-native";
import { registerDevice, deactivateDevice } from "./service";
export type NativePushToken = Notifications.DevicePushToken;
const key = "roam.notification.installation";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // Foreground uses the existing in-app feedback host, never a duplicate system banner.
    shouldShowBanner: AppState.currentState !== "active",
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export async function installationId() {
  let id = await SecureStore.getItemAsync(key);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(key, id);
  }
  return id;
}
export async function notificationPermission() {
  const p = await Notifications.getPermissionsAsync();
  return p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}
export async function registerPush(
  requestPermission = false,
  nativeToken?: NativePushToken,
) {
  if (!Device.isDevice) return false;
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("roam", {
      name: "Roam updates",
      importance: AndroidImportance.DEFAULT,
    });
  let allowed = await notificationPermission();
  if (!allowed && requestPermission) {
    const p = await Notifications.requestPermissionsAsync();
    allowed = p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  }
  const id = await installationId();
  if (!allowed) {
    await deactivateDevice(id);
    return false;
  }
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Push notifications need an EAS project.");
  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
    ...(nativeToken ? { devicePushToken: nativeToken } : {}),
  });
  await registerDevice(
    token.data,
    Platform.OS === "ios" ? "ios" : "android",
    id,
  );
  return true;
}
export async function disablePushDevice() {
  await deactivateDevice(await installationId());
}
export function observeNotifications(
  onOpen: (id: string) => void,
  onRefresh: (token?: NativePushToken) => void,
  onReceive?: (id: string) => void,
) {
  const opened = new Set<string>();
  const received = new Set<string>();
  const remember = (set: Set<string>, id: string) => {
    set.add(id);
    if (set.size > 128) set.delete(set.values().next().value!);
  };
  const open = (response: Notifications.NotificationResponse | null) => {
    if (!response || opened.has(response.notification.request.identifier))
      return;
    remember(opened, response.notification.request.identifier);
    const id = response.notification.request.content.data?.notification_id;
    if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) onOpen(id);
    void Notifications.clearLastNotificationResponseAsync();
  };
  void Notifications.getLastNotificationResponseAsync()
    .then(open)
    .catch(() => {});
  const response = Notifications.addNotificationResponseReceivedListener(open);
  const receipt = onReceive
    ? Notifications.addNotificationReceivedListener((notification) => {
        const id = notification.request.content.data?.notification_id;
        if (
          AppState.currentState !== "active" ||
          typeof id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(id) ||
          received.has(id)
        )
          return;
        remember(received, id);
        onReceive(id);
      })
    : null;
  const refresh = Notifications.addPushTokenListener((token) =>
    onRefresh(token),
  );
  return () => {
    response.remove();
    receipt?.remove();
    refresh.remove();
  };
}
