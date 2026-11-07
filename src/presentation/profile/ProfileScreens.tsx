import { RoamSheet } from "../brand/overlays";
import { FeedbackNotice } from "../brand/ToastFeedback";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { FunctionalIcon, type FunctionalIconName } from "../icons";
import { router } from "expo-router";
import { useAuth } from "../../platform/auth/AuthProvider";
import { disablePushDevice } from "../../platform/notifications/device";
import { requireSupabase } from "../../platform/supabase";
import { saveProfile } from "../../platform/profiles/service";
import { normalizeDisplayName } from "../../platform/profiles/validation";
import { getRewardDashboard } from "../../platform/rewards/service";
import { groupService } from "../../platform/groups/service";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import { PlayerAvatar } from "../brand/PlayerAvatar";
import { useRoamTheme } from "../brand/theme";
import { successFeedback } from "../brand/feedback";
import {
  Body,
  ErrorState,
  Loading,
  ProgressIndicator,
  RoamButton,
  RoamCard,
  RoamHeader,
  RoamScreen,
  SectionHeading,
} from "../brand/ui";
import { Field, Screen } from "../brand/forms";
function SettingRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: FunctionalIconName;
  onPress: () => void;
}) {
  const { colors, type } = useRoamTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 14,
        alignItems: "center",
        minHeight: 56,
        paddingVertical: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <FunctionalIcon
        accessible={false}
        name={icon}
        size={23}
        color={colors.brandPrimary}
      />
      <Text style={[type.body, { color: colors.textPrimary, flex: 1 }]}>
        {label}
      </Text>
      <FunctionalIcon
        accessible={false}
        name="chevron-forward"
        size={18}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}
export function ProfileScreen() {
  const auth = useAuth();
  const [actionsOpen, setActionsOpen] = useState(false);
  const { colors, type } = useRoamTheme();
  const rewards = useAccountResource(getRewardDashboard);
  const groups = useAccountResource(groupService.list);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signingOut = useRef(false);
  async function signOut() {
    if (signingOut.current) return;
    signingOut.current = true;
    setBusy(true);
    setError("");
    try {
      await disablePushDevice();
      const result = await requireSupabase().auth.signOut();
      if (result.error)
        throw new Error("Unable to sign out. Check your connection and retry.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to sign out. Please retry.",
      );
    } finally {
      signingOut.current = false;
      setBusy(false);
    }
  }
  const data = rewards.data;
  return (
    <RoamScreen background="profile">
      <RoamHeader
        title="Your Profile"
        icon="ellipsis-horizontal"
        actionLabel="Profile actions"
        action={() => setActionsOpen(true)}
      />
      {auth.profileLoading ? <Loading label="Loading your profile…" /> : null}
      {auth.error ? (
        <ErrorState
          message={auth.error}
          retry={() => void auth.reloadProfile()}
        />
      ) : null}
      {auth.profile ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
          <PlayerAvatar name={auth.profile.display_name} size={56} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text
              accessibilityRole="header"
              style={[type.title1, { color: colors.textPrimary }]}
            >
              {auth.profile.display_name}
            </Text>
            {data ? (
              <Text style={[type.headline, { color: colors.brandPrimary }]}>
                Level {data.progress.level}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <View style={{ alignSelf: "flex-start" }}>
        <RoamButton
          variant="outline"
          size="small"
          label="Edit Profile"
          actionIcon="edit"
          onPress={() => router.push("/edit-profile")}
        />
      </View>
      <SectionHeading>Your progress</SectionHeading>
      {rewards.loading ? <Loading label="Loading your progression…" /> : null}
      {rewards.error ? (
        <ErrorState message={rewards.error} retry={rewards.refresh} />
      ) : null}
      {data ? (
        <RoamCard>
          <Body>{data.progress.total_xp.toLocaleString()} total XP</Body>
          <ProgressIndicator current={data.progress.progress} total={1} />
          <Body>
            {data.progress.xp_to_next_level === null
              ? "Highest level reached"
              : `${data.progress.xp_to_next_level} XP to level ${data.progress.level + 1}`}
          </Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {groups.data ? (
              <Stat value={groups.data.length} label="Groups joined" />
            ) : null}
            <Stat
              value={data.achievements.filter((item) => item.earned_id).length}
              label="Achievements"
            />
            <Stat
              value={data.collectibles.filter((item) => item.owned_id).length}
              label="Cards"
            />
          </View>
          <RoamButton
            variant="ghost"
            size="small"
            label="View rewards"
            icon="rewards"
            onPress={() => router.navigate("/rewards")}
          />
        </RoamCard>
      ) : null}
      {groups.loading ? (
        <Loading label="Loading your groups…" />
      ) : groups.error ? (
        <ErrorState message={groups.error} retry={groups.refresh} />
      ) : null}
      <RoamSheet
        visible={actionsOpen}
        title="Profile actions"
        onClose={() => setActionsOpen(false)}
      >
        <RoamButton
          label="Edit Profile"
          actionIcon="edit"
          variant="secondary"
          onPress={() => {
            setActionsOpen(false);
            router.push("/edit-profile");
          }}
        />
        <RoamButton
          label="Privacy & account"
          variant="ghost"
          onPress={() => {
            setActionsOpen(false);
            router.push("/privacy");
          }}
        />
      </RoamSheet>
      <SectionHeading>Account settings</SectionHeading>
      <RoamCard>
        <SettingRow
          label="Notifications"
          icon="notifications-outline"
          onPress={() => router.push("/notification-settings")}
        />
        <SettingRow
          label="Privacy & account"
          icon="lock-closed-outline"
          onPress={() => router.push("/privacy")}
        />
      </RoamCard>
      {error ? <ErrorState message={error} /> : null}
      <RoamButton
        variant="destructive"
        loading={busy}
        label={busy ? "Signing out…" : "Sign out"}
        actionIcon="logout"
        disabled={busy}
        onPress={() => void signOut()}
      />
    </RoamScreen>
  );
}
function Stat({ value, label }: { value: number; label: string }) {
  const { colors, type } = useRoamTheme();
  return (
    <View style={{ gap: 4, flexGrow: 1, flexBasis: 140 }}>
      <Text style={[type.title1, { color: colors.brandPrimary }]}>{value}</Text>
      <Body>{label}</Body>
    </View>
  );
}
export function EditProfile() {
  const auth = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const running = useRef(false);
  async function save() {
    if (running.current || !auth.session || !auth.profile) return;
    try {
      normalizeDisplayName(name ?? auth.profile.display_name);
    } catch (failure) {
      setError((failure as Error).message);
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await saveProfile(
        auth.session.user.id,
        name ?? auth.profile.display_name,
      );
      await auth.reloadProfile();
      successFeedback();
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to save your profile. Please retry.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen title="Edit Profile" backTo="/profile">
      {auth.profileLoading ? <Loading /> : null}
      {auth.error ? (
        <ErrorState
          message={auth.error}
          retry={() => void auth.reloadProfile()}
        />
      ) : null}
      {auth.profile ? (
        <>
          <PlayerAvatar name={name ?? auth.profile.display_name} size={56} />

          <Field
            label="Display name"
            value={name ?? auth.profile.display_name}
            onChangeText={(value) => {
              setName(value);
              setError("");
              setSaved(false);
            }}
            maxLength={50}
            autoComplete="name"
            editable={!busy}
            error={error || undefined}
          />
          <RoamButton
            label={busy ? "Saving…" : "Save changes"}
            disabled={
              busy ||
              (name ?? auth.profile.display_name).trim() ===
                auth.profile.display_name
            }
            loading={busy}
            onPress={save}
          />
        </>
      ) : null}
      {saved ? <FeedbackNotice message="Profile saved." /> : null}
    </Screen>
  );
}
