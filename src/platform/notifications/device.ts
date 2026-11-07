import type { DevicePushToken } from "expo-notifications";
export type NativePushToken = DevicePushToken;
// Web deliberately supports the in-app center without native push APIs.
export const notificationPermission = async () => false;
export const registerPush = async (
  _requestPermission = false,
  _nativeToken?: NativePushToken,
) => false;
export const disablePushDevice = async () => {};
export const observeNotifications =
  (
    _onOpen: (id: string) => void,
    _onRefresh: (token?: NativePushToken) => void,
    _onReceive?: (id: string) => void,
  ) =>
  () => {};
