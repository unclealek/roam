import { selectionFeedback, successFeedback } from "../brand/feedback";
import { FunctionalIcon } from "../icons";
import { useRoamTheme } from "../brand/theme";
import { RoamMascot } from "../brand/RoamMascot";
import { FeedbackNotice } from "../brand/ToastFeedback";
import { Fragment, useCallback, useRef, useState } from "react";
import { AppState, Linking, Platform, Switch, View, Text } from "react-native";
import { router, type Href, useFocusEffect } from "expo-router";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import { useAuth } from "../../platform/auth/AuthProvider";
import {
  getPreferences,
  listNotifications,
  markNotification,
  savePreferences,
} from "../../platform/notifications/service";
import {
  notificationPermission,
  registerPush,
  disablePushDevice,
} from "../../platform/notifications/device";
import {
  notificationTarget,
  notificationDestination,
} from "../../platform/notifications/routes";
import type { NotificationPreferences } from "../../platform/notifications/types";
import {
  Body,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Panel,
  Screen,
} from "../brand/forms";
import { useResumeRefresh } from "../brand/useResumeRefresh";

export function NotificationCenter() {
  const { colors, type } = useRoamTheme();
  const [cursor, setCursor] = useState<{ id: string; created_at: string }>();
  const load = useCallback(() => listNotifications(cursor), [cursor]);
  const resource = useAccountResource(load, { retainOnRefresh: true });
  useResumeRefresh(resource.refresh);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = async (work: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      setError(null);
      await work();
      resource.refresh();
    } catch {
      setError("Unable to update this notification. Please try again.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Notifications"
      backTo="/"
      refreshing={resource.refreshing}
      onRefresh={() => {
        setCursor(undefined);
        resource.refresh();
      }}
    >
      <Button
        label="Refresh notifications"
        variant="ghost"
        size="small"
        onPress={() => {
          setCursor(undefined);
          resource.refresh();
        }}
      />
      <Button
        label="Notifications"
        actionIcon="settings"
        onPress={() => router.push("/notification-settings")}
      />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.refresh} />
      ) : (
        <>
          <Body>{resource.data?.unread_count ?? 0} unread</Body>
          {!resource.data?.items.length ? (
            <>
              <RoamMascot size={140} placement="small" state="waiting" />
              <EmptyState
                title="You’re all caught up"
                message="Your game updates appear here."
              />
            </>
          ) : null}
          {resource.data?.items.map((n, index) => (
            <Fragment key={n.id}>
              {index === 0 ||
              new Date(
                resource.data!.items[index - 1].created_at,
              ).toDateString() !== new Date(n.created_at).toDateString() ? (
                <Text
                  accessibilityRole="header"
                  style={[
                    type.headline,
                    { color: colors.textSecondary, marginTop: 12 },
                  ]}
                >
                  {new Date(n.created_at).toDateString() ===
                  new Date().toDateString()
                    ? "Today"
                    : new Date(n.created_at).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                </Text>
              ) : null}
              <Panel>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <FunctionalIcon
                    accessible={false}
                    name={
                      notificationCategories[n.category]?.icon ??
                      "notifications-outline"
                    }
                    size={24}
                    color={colors.brandPrimary}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={[type.headline, { color: colors.textPrimary }]}
                    >
                      {n.title}
                    </Text>
                    <Text
                      style={[type.caption, { color: colors.textSecondary }]}
                    >
                      {notificationCategories[n.category]?.label ??
                        "Notification"}{" "}
                      · {n.read_at ? "Read" : "Unread"}
                    </Text>
                  </View>
                </View>
                {n.created_at ? (
                  <Text style={[type.caption, { color: colors.textSecondary }]}>
                    {new Date(n.created_at).toLocaleString()}
                  </Text>
                ) : null}
                <Body>{n.body}</Body>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  {!n.read_at ? (
                    <View
                      accessible={false}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: colors.brandPrimary,
                      }}
                    />
                  ) : null}
                  <Text style={[type.caption, { color: colors.textSecondary }]}>
                    Opens {notificationDestination(notificationTarget(n))}
                  </Text>
                </View>
                <Button
                  variant="outline"
                  size="small"
                  label="Open notification"
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      const route = notificationTarget(n);
                      if (!route) throw new Error("Invalid route");
                      await markNotification(n.id);
                      if (route !== "/notifications")
                        router.push(route as Href);
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="small"
                  label={n.read_at ? "Mark unread" : "Mark as read"}
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await markNotification(n.id, !n.read_at);
                      selectionFeedback();
                    })
                  }
                />
              </Panel>
            </Fragment>
          ))}
          {resource.data?.items.length === 30 ? (
            <Button
              label="Next page"
              disabled={busy}
              onPress={() => {
                const last = resource.data!.items.at(-1)!;
                setCursor({ id: last.id, created_at: last.created_at });
              }}
            />
          ) : null}
          {cursor ? (
            <Button
              label="Newest notifications"
              disabled={busy}
              onPress={() => setCursor(undefined)}
            />
          ) : null}
        </>
      )}
      {busy ? <Loading label="Updating notification…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      <Button label="Back to Home" onPress={() => router.dismissTo("/")} />
    </Screen>
  );
}
const switches = [
  ["push_enabled", "Push notifications enabled"],
  ["group_updates_enabled", "Group updates"],
  ["game_updates_enabled", "Game updates"],
  ["your_turn_enabled", "My turn notifications"],
  ["secret_messages_enabled", "Secret messages"],
  ["reminders_enabled", "Activity reminders"],
  ["rewards_enabled", "Rewards and achievements"],
  ["quiet_hours_enabled", "Quiet hours enabled"],
] as const;
const notificationCategories = {
  group_updates: { label: "Groups", icon: "people-outline" },
  game_updates: { label: "Games", icon: "game-controller-outline" },
  your_turn: { label: "Your turn", icon: "play-outline" },
  secret_messages: { label: "Secret messages", icon: "lock-closed-outline" },
  reminders: { label: "Reminders", icon: "time-outline" },
  rewards: { label: "Rewards", icon: "ribbon-outline" },
} as const;
function PreferenceForm({ initial }: { initial: NotificationPreferences }) {
  const { colors, type } = useRoamTheme();
  const saving = useRef(false);
  const permissionRequested = useRef(false);
  const [pref, setPref] = useState(initial);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [busy, setBusy] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const check = () => {
        void notificationPermission()
          .then((p) => {
            if (active) setPermission(p);
          })
          .catch(() => {});
      };
      check();
      const listener = AppState.addEventListener("change", (s) => {
        if (s === "active") check();
      });
      return () => {
        active = false;
        listener.remove();
      };
    }, []),
  );
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage(null);
    setSaveError(false);
    try {
      let push = pref.push_enabled;
      let devicePermissionOff = false;
      if (push && Platform.OS !== "web") {
        const requestPermission =
          !initial.push_enabled && !permissionRequested.current;
        if (requestPermission) permissionRequested.current = true;
        const allowed = await registerPush(requestPermission);
        setPermission(allowed);
        devicePermissionOff = !allowed;
        // A denied device must not disable other already-authorized devices.
        if (!allowed && !initial.push_enabled) push = false;
      } else if (!push) await disablePushDevice();
      const { user_id: _user, updated_at: _updated, ...patch } = pref;
      const result = await savePreferences({ ...patch, push_enabled: push });
      setPref(result);
      successFeedback();
      setMessage(
        devicePermissionOff
          ? push
            ? "Push remains enabled for your other devices. Notification permission is off on this device."
            : "Push permission is off or unavailable on this device. Your in-app notifications remain available."
          : "Notifications saved.",
      );
    } catch {
      setSaveError(true);
      setMessage(
        "Unable to save settings. Check your times (HH:MM), IANA timezone and connection.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {Platform.OS === "web" ? (
        <Body>For push alerts, open the Roam app.</Body>
      ) : (
        <Body>
          Device alerts:{" "}
          {permission === null
            ? "checking…"
            : permission
              ? "allowed"
              : "off or unavailable"}
          .
        </Body>
      )}
      <Panel>
        <Text
          accessibilityRole="header"
          style={[type.title2, { color: colors.textPrimary }]}
        >
          Updates
        </Text>
        <Body>Updates stay in Roam when alerts are off.</Body>
        {switches.map(([key, label]) => (
          <View
            key={key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              minHeight: 52,
            }}
          >
            <Text style={[type.body, { color: colors.textPrimary, flex: 1 }]}>
              {label}
            </Text>
            <Switch
              accessibilityLabel={label}
              trackColor={{ false: colors.border, true: colors.brandPrimary }}
              disabled={
                busy || (key === "push_enabled" && Platform.OS === "web")
              }
              value={pref[key]}
              onValueChange={(value) =>
                setPref((p) => ({ ...p, [key]: value }))
              }
            />
          </View>
        ))}
      </Panel>
      <Panel>
        <Text
          accessibilityRole="header"
          style={[type.title2, { color: colors.textPrimary }]}
        >
          Quiet hours
        </Text>
        {(
          [
            "preferred_reminder_time",
            "quiet_hours_start",
            "quiet_hours_end",
            "timezone",
          ] as const
        ).map((key) => (
          <Field
            key={key}
            label={
              {
                preferred_reminder_time: "Reminder time (HH:MM)",
                quiet_hours_start: "Quiet from (HH:MM)",
                quiet_hours_end: "Quiet until (HH:MM)",
                timezone: "Timezone (e.g. Europe/Helsinki)",
              }[key]
            }
            value={pref[key]}
            autoCapitalize="none"
            editable={!busy}
            onChangeText={(value) => setPref((p) => ({ ...p, [key]: value }))}
          />
        ))}
        <Body>
          At most one reminder a day. Matching quiet-hour times mute alerts all
          day.
        </Body>
      </Panel>
      <Button
        label={busy ? "Saving…" : "Save settings"}
        disabled={busy}
        loading={busy}
        onPress={save}
      />
      <Button
        label="Device settings"
        actionIcon="settings"
        onPress={() => {
          if (Platform.OS === "web") {
            setMessage(
              "Open Roam in the iOS or Android app to manage device notification permission.",
            );
            return;
          }
          void Promise.resolve()
            .then(() => Linking.openSettings())
            .catch(() =>
              setMessage(
                "Open system settings to manage notification permission.",
              ),
            );
        }}
      />
      {message ? (
        saveError ? (
          <ErrorState message={message} />
        ) : (
          <FeedbackNotice message={message} />
        )
      ) : null}
    </>
  );
}
export function NotificationSettings() {
  const userId = useAuth().session?.user.id;
  const resource = useAccountResource(getPreferences);
  return (
    <Screen title="Notifications" backTo="/profile">
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.refresh} />
      ) : resource.data ? (
        <PreferenceForm key={userId} initial={resource.data} />
      ) : null}
      <Button
        label="Back to notifications"
        onPress={() => router.dismissTo("/notifications")}
      />
    </Screen>
  );
}
