import { ReportSheet } from "../safety/ReportSheet";
import type { ReportTarget } from "../../platform/safety/report";
import { GroupSymbol } from "../icons/GroupSymbol";
import { RoamIllustration, RoamIcon, FunctionalIcon } from "../icons";
import { RoamDialog } from "../brand/overlays";
import { FeedbackNotice } from "../brand/ToastFeedback";
import { SantaGroupLobbies } from "./GroupLobbies";
import {
  GroupCard as GroupOverviewCard,
  GroupCardSurface,
} from "../brand/GroupCard";
import { PlayerAvatar } from "../brand/PlayerAvatar";
import { RoamHeader, RoamScreen, SectionHeading } from "../brand/ui";
import { useRoamTheme } from "../brand/theme";
import { successFeedback } from "../brand/feedback";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Share, Text, View, Pressable, TextInput } from "react-native";
import { useAuth } from "../../platform/auth/AuthProvider";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import { groupService } from "../../platform/groups/service";
import { sessionService } from "../../platform/sessions/service";
import {
  type Group,
  type GroupDetails,
  type GroupInput,
  type GroupPreview,
  type NewInvite,
} from "../../platform/groups/types";

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
function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const running = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function run<T>(
    operation: () => Promise<T>,
    success?: (value: T) => void,
  ) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await operation();
      if (active.current) {
        successFeedback();
        success?.(value);
      }
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error
            ? e.message
            : "Unable to complete this request. Try again.",
        );
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  }
  return { busy, message, error, run, setMessage };
}
function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      {action.busy ? <Loading label="Working…" /> : null}
      {action.error ? <ErrorState message={action.error} /> : null}
      {action.message ? (
        <Animated.View
          entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
        >
          <FeedbackNotice message={action.message} />
        </Animated.View>
      ) : null}
    </>
  );
}
const path = (id: string, suffix = "") => `/group/${id}${suffix}` as never;
function GroupSummary({ group }: { group: Group | GroupPreview }) {
  return (
    <GroupCardSurface>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <GroupSymbol iconKey={group.icon_key} size={32} />
        <Body>{group.name}</Body>
      </View>
      {group.description ? <Body>{group.description}</Body> : null}
      <Body>
        {group.member_count} {group.member_count === 1 ? "member" : "members"}
      </Body>
    </GroupCardSurface>
  );
}
export function MyGroups() {
  const [search, setSearch] = useState("");
  const { colors, type } = useRoamTheme();
  const { data, loading, error, refresh } = useAccountResource(
    groupService.list,
  );
  return (
    <RoamScreen>
      <RoamHeader
        title="Your Groups"
        action={() => router.push("/group/create")}
        actionLabel="Create a new group"
        icon="add"
      />
      <TextInput
        accessibilityLabel="Search your groups"
        placeholder="Search your groups"
        placeholderTextColor={colors.textSecondary}
        value={search}
        onChangeText={setSearch}
        style={{
          ...type.callout,
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          padding: 16,
          minHeight: 52,
        }}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Create Group"
            actionIcon="add"
            onPress={() => router.push("/group/create")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            secondary
            label="Join a Group"
            icon="groups"
            onPress={() => router.push("/group/join")}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <RoamIcon name="groups" size={24} />
        <SectionHeading>Active groups</SectionHeading>
      </View>
      {loading ? (
        <Loading label="Loading your groups…" />
      ) : error ? (
        <ErrorState message={error} retry={refresh} />
      ) : data?.length ? (
        <>
          {data
            .filter((g) =>
              g.name
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()),
            )
            .map((g) => (
              <GroupOverview key={g.id} group={g} />
            ))}
          {search.trim() &&
          !data.some((g) =>
            g.name
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()),
          ) ? (
            <Body>No groups found.</Body>
          ) : null}
        </>
      ) : (
        <>
          <RoamIllustration
            name="empty-groups"
            size={120}
            label="Your group adventures await"
          />
          <SectionHeading>Bring your people together.</SectionHeading>
          <Body>Create a group or join with a code.</Body>
        </>
      )}
    </RoamScreen>
  );
}
function GroupOverview({ group }: { group: Group }) {
  const load = useCallback(() => groupService.get(group.id), [group.id]);
  const details = useAccountResource(load);
  return (
    <View style={{ gap: 8 }}>
      <GroupOverviewCard
        group={group}
        details={details.data?.members ? details.data : undefined}
      />
      {details.error ? (
        <ErrorState
          message="Couldn’t load group details."
          retry={details.refresh}
        />
      ) : null}
    </View>
  );
}
function GroupForm({
  initial,
  onSubmit,
  busy,
  label,
}: {
  initial?: GroupInput;
  onSubmit: (input: GroupInput) => void;
  busy: boolean;
  label: string;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const { colors } = useRoamTheme();
  const [touched, setTouched] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    initial?.icon_key || null,
  );
  return (
    <>
      <Field
        label="Group name"
        value={name}
        onChangeText={setName}
        onBlur={() => setTouched(true)}
        error={touched && !name.trim() ? "Enter a group name." : undefined}
        maxLength={80}
        editable={!busy}
      />
      <Field
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        editable={!busy}
      />
      <Body>Group icon (optional)</Body>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["", "people", "sparkles", "coffee", "planet", "heart"].map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            aria-pressed={selected === (key || null)}
            accessibilityLabel={key ? `${key} icon` : "No icon"}
            accessibilityState={{
              selected: selected === (key || null),
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => setSelected(key || null)}
            style={{
              minHeight: 48,
              minWidth: 48,
              padding: 12,
              borderRadius: 18,
              borderWidth: 2,
              borderColor:
                selected === (key || null)
                  ? colors.brandPrimary
                  : colors.border,
              backgroundColor: colors.surface,
            }}
          >
            {key ? (
              <GroupSymbol iconKey={key} size={24} />
            ) : (
              <FunctionalIcon name="remove" size={24} />
            )}
          </Pressable>
        ))}
      </View>
      <Button
        label={busy ? "Saving…" : label}
        disabled={busy || !name.trim()}
        onPress={() => onSubmit({ name, description, icon_key: selected })}
      />
    </>
  );
}
export function CreateGroup() {
  const action = useAction();
  const [setupVice, setSetupVice] = useState(false);
  return (
    <Screen title="Create Group">
      {setupVice ? (
        <Body>
          A vice owner takes over when you leave. You can choose one after a
          friend joins.
        </Body>
      ) : null}
      <Button
        label={setupVice ? "Skip vice owner" : "Add a vice owner later"}
        disabled={action.busy}
        onPress={() => setSetupVice(!setupVice)}
      />
      <GroupForm
        busy={action.busy}
        label="Create Group"
        onSubmit={(input) =>
          void action.run(
            () => groupService.create(input),
            (g) => router.replace(path(g.id, setupVice ? "/members" : "")),
          )
        }
      />
      <Feedback action={action} />
      <Button
        secondary
        label="Back to Groups"
        onPress={() => router.replace("/groups")}
      />
    </Screen>
  );
}
export function JoinGroup() {
  const action = useAction();
  const memberships = useAccountResource(groupService.list);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  return (
    <Screen
      key={preview ? "preview" : "enter-code"}
      title={preview ? "Invitation Preview" : "Join Group"}
    >
      {preview ? (
        <>
          <GroupSummary group={preview} />
          <Body>Join this group? You’ll join each game separately.</Body>
          {Array.isArray(memberships.data) &&
          memberships.data.some((group) => group.id === preview.id) ? (
            <>
              <Body>You’re already a member.</Body>
              <Button
                label="Open group"
                onPress={() => router.replace(path(preview.id))}
              />
            </>
          ) : (
            <Button
              label="Join group"
              disabled={action.busy}
              onPress={() =>
                void action.run(
                  () => groupService.join(code),
                  (g) => router.replace(`/group/${g.id}?joined=1` as never),
                )
              }
            />
          )}
          <Button
            label="Use another code"
            disabled={action.busy}
            onPress={() => setPreview(null)}
          />
        </>
      ) : (
        <>
          <Body>Enter your invite code.</Body>
          <Field
            label="Invite code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!action.busy}
          />
          <Button
            label="Find group"
            disabled={action.busy || !code.trim()}
            onPress={() =>
              void action.run(() => groupService.preview(code), setPreview)
            }
          />
        </>
      )}
      <Feedback action={action} />
      <Button
        secondary
        label="Back to Groups"
        onPress={() => router.replace("/groups")}
      />
    </Screen>
  );
}
type GroupMode = "details" | "members" | "settings" | "invites";
export function GroupRoute({ mode }: { mode: GroupMode }) {
  const { groupId, joined } = useLocalSearchParams<{
    groupId: string;
    joined?: string;
  }>();
  const userId = useAuth().session?.user.id;
  return (
    <GroupResource
      key={`${userId}:${groupId}:${mode}`}
      id={groupId}
      mode={mode}
      joined={joined === "1"}
    />
  );
}
function GroupResource({
  id,
  mode,
  joined,
}: {
  id: string;
  mode: GroupMode;
  joined: boolean;
}) {
  const load = useCallback(() => groupService.get(id), [id]);
  const resource = useAccountResource(load);
  return resource.loading ? (
    <Screen title="Group">
      <Loading />
    </Screen>
  ) : resource.error || !resource.data ? (
    <Screen title="Group">
      <ErrorState
        message={resource.error || "Group unavailable."}
        retry={resource.refresh}
      />
      <Button
        secondary
        label="Back to Groups"
        onPress={() => router.replace("/groups")}
      />
    </Screen>
  ) : (
    <GroupContent
      key={`${resource.data.id}:${resource.data.updated_at}`}
      group={resource.data}
      joined={joined}
      mode={mode}
      refresh={resource.refresh}
    />
  );
}
function GroupContent({
  group: g,
  mode,
  refresh,
  joined,
}: {
  group: GroupDetails;
  joined: boolean;
  mode: GroupMode;
  refresh: () => void;
}) {
  const userId = useAuth().session?.user.id;
  const owner = g.owner_id === userId;
  const action = useAction();
  const [confirm, setConfirm] = useState<{
    label: string;
    operation: () => Promise<unknown>;
    leave?: boolean;
  } | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [report, setReport] = useState<ReportTarget | null>(null);
  const title =
    mode === "details"
      ? g.name
      : mode === "members"
        ? "Group Members"
        : mode === "settings"
          ? "Group Settings"
          : "Invite Friends";
  const manage = (
    label: string,
    operation: () => Promise<unknown>,
    leave = false,
  ) => setConfirm({ label, operation, leave });
  const ownerName =
    g.members.find((m) => m.user_id === g.owner_id)?.display_name ||
    "Group owner";
  const viceName = g.members.find(
    (m) => m.user_id === g.vice_owner_id,
  )?.display_name;
  let content: ReactNode;
  if (mode === "details") {
    const current = g.sessions.filter((s) =>
      ["draft", "lobby", "active"].includes(s.status),
    );
    const past = g.sessions.filter(
      (s) => !["draft", "lobby", "active"].includes(s.status),
    );
    content = (
      <>
        <GroupSummary group={g} />
        <Button
          label="Play a Game"
          icon="play"
          onPress={() =>
            router.push({ pathname: "/games", params: { groupId: g.id } })
          }
        />
        <Button
          secondary
          label="Invite Friends"
          actionIcon="share"
          onPress={() => router.push(path(g.id, "/invites"))}
        />
        <SectionHeading>Members</SectionHeading>
        {g.members.slice(0, 4).map((member) => (
          <GroupMemberRow
            key={member.user_id}
            member={member}
            viceId={g.vice_owner_id}
          />
        ))}
        <Body>Owner: {ownerName}</Body>
        <Body>Vice owner: {viceName || "Not appointed"}</Body>
        <Button
          secondary
          label="View members"
          icon="groups"
          onPress={() => router.push(path(g.id, "/members"))}
        />
        {owner ? (
          <Button
            secondary
            label="Group Settings"
            actionIcon="settings"
            onPress={() => router.push(path(g.id, "/settings"))}
          />
        ) : null}
        <SectionHeading>Active games</SectionHeading>
        {current.length ? (
          current.map((s) => (
            <Button
              key={s.id}
              label={s.name}
              onPress={() => router.push(`/session/${s.id}` as never)}
            />
          ))
        ) : (
          <EmptyState
            title="No active games"
            message="Start a game together."
          />
        )}
        <SectionHeading>Past games</SectionHeading>
        {past.length ? (
          past.map((s) => (
            <Button
              key={s.id}
              label={s.name}
              onPress={() => router.push(`/session/${s.id}` as never)}
            />
          ))
        ) : (
          <Body>No past games.</Body>
        )}
        <SantaGroupLobbies groupId={g.id} />
        {userId ? (
          <Button
            label="Report group"
            variant="ghost"
            actionIcon="flag-outline"
            onPress={() => setReport({ type: "group", groupId: g.id })}
          />
        ) : null}
        <JoinSession />
        <Button
          label="Leave group"
          danger
          disabled={action.busy || (owner && !g.vice_owner_id)}
          onPress={() =>
            manage(
              owner
                ? `Leave this group? ${viceName} will become the owner.`
                : "Leave this group?",
              () => groupService.leave(g.id),
              true,
            )
          }
        />
        {owner && !g.vice_owner_id ? (
          <Body>Choose a new owner before leaving.</Body>
        ) : null}
      </>
    );
  } else if (mode === "members")
    content = (
      <>
        <Body>
          Vice owner: {viceName || "Not appointed"}. Takes over when the owner
          leaves.
        </Body>
        {owner && g.members.length < 2 ? (
          <Body>Invite a friend first.</Body>
        ) : null}
        {g.members.map((m) => (
          <Panel key={m.user_id}>
            <GroupMemberRow member={m} viceId={g.vice_owner_id} />
            {userId && m.user_id !== userId ? (
              <Button
                label="Report member"
                accessibilityLabel={`Report member ${m.display_name}`}
                variant="ghost"
                actionIcon="flag-outline"
                onPress={() =>
                  setReport({
                    type: "user",
                    groupId: g.id,
                    userId: m.user_id,
                    displayName: m.display_name,
                  })
                }
              />
            ) : null}
            {owner && m.user_id !== userId ? (
              <>
                <Button
                  label={
                    g.vice_owner_id === m.user_id
                      ? `Remove ${m.display_name} as vice owner`
                      : `Make ${m.display_name} vice owner`
                  }
                  disabled={action.busy}
                  onPress={() =>
                    manage(
                      g.vice_owner_id === m.user_id
                        ? `Remove ${m.display_name} as vice owner? You must appoint another vice or transfer ownership before leaving or deleting your account.`
                        : `Make ${m.display_name} vice owner? The vice takes over when you leave or delete your account.`,
                      () =>
                        groupService.setVice(
                          g.id,
                          g.vice_owner_id === m.user_id ? null : m.user_id,
                        ),
                    )
                  }
                />
                <Button
                  label={`Remove ${m.display_name}`}
                  disabled={action.busy}
                  danger
                  onPress={() =>
                    manage(
                      `Remove ${m.display_name}? Their existing game membership stays unchanged.`,
                      () => groupService.remove(g.id, m.user_id),
                    )
                  }
                />
                <Button
                  label={`Transfer ownership to ${m.display_name}`}
                  disabled={action.busy}
                  onPress={() =>
                    manage(
                      `Make ${m.display_name} the owner? You will become a member.`,
                      () => groupService.transfer(g.id, m.user_id),
                    )
                  }
                />
              </>
            ) : null}
          </Panel>
        ))}
      </>
    );
  else if (mode === "settings")
    content = owner ? (
      <>
        <GroupForm
          initial={g}
          busy={action.busy}
          label="Save group settings"
          onSubmit={(input) =>
            void action.run(
              () => groupService.update(g.id, input, g),
              () => {
                action.setMessage("Group settings saved.");
              },
            )
          }
        />
        <Body>
          Choose a vice owner in Members. Groups with games can’t be deleted.
        </Body>
        <Button
          label="Manage members"
          icon="groups"
          onPress={() => router.push(path(g.id, "/members"))}
        />
        <Field
          label="Type DELETE to delete this group"
          value={deleteText}
          onChangeText={setDeleteText}
          autoCapitalize="characters"
        />
        <Button
          label="Delete group"
          actionIcon="delete"
          danger
          disabled={action.busy || deleteText !== "DELETE"}
          onPress={() =>
            manage(
              "Permanently delete this group and its invitations?",
              () => groupService.delete(g.id),
              true,
            )
          }
        />
      </>
    ) : (
      <EmptyState
        title="Owner access required"
        message="Only the owner can change group settings."
      />
    );
  else
    content = owner ? (
      <InvitationPanel key={g.id} group={g} refresh={refresh} />
    ) : (
      <EmptyState
        title="Ask your group owner"
        message="Only the owner can generate and revoke invitation codes."
      />
    );
  return (
    <Screen title={title}>
      {joined && mode === "details" ? (
        <FeedbackNotice
          id={`group-joined:${g.id}`}
          message="You’ve joined the group. Let’s play!"
        />
      ) : null}
      {content}
      {report ? (
        <ReportSheet target={report} onClose={() => setReport(null)} />
      ) : null}
      {confirm ? (
        <RoamDialog
          visible
          title="Confirm group change"
          message={confirm.label}
          kind={
            /^(Leave|Remove|Permanently delete)/.test(confirm.label)
              ? "destructive"
              : "confirmation"
          }
          busy={action.busy}
          error={action.error}
          confirmLabel="Confirm"
          cancelLabel="Keep group unchanged"
          onConfirm={() =>
            action.run(confirm.operation, () => {
              setConfirm(null);
              if (confirm.leave) router.replace("/groups");
              else refresh();
            })
          }
          onCancel={() => setConfirm(null)}
        />
      ) : (
        <Feedback action={action} />
      )}
      {mode !== "details" ? (
        <Button
          secondary
          label="Back to group"
          onPress={() => router.replace(path(g.id))}
        />
      ) : null}
      <Button
        secondary
        label="Back to Groups"
        onPress={() => router.replace("/groups")}
      />
    </Screen>
  );
}
function InvitationPanel({
  group: g,
  refresh,
}: {
  group: GroupDetails;
  refresh: () => void;
}) {
  const action = useAction();
  const [fresh, setFresh] = useState<NewInvite | null>(null);
  const [days, setDays] = useState("7");
  const [uses, setUses] = useState("");
  const [revoked, setRevoked] = useState<string[]>([]);
  const [invites, setInvites] = useState(g.invites);
  return (
    <>
      <SectionHeading>{g.name}</SectionHeading>
      <Body>Codes are shown once. Save or share yours.</Body>
      <Field
        label="Expires in (days, 1–30)"
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
      />
      <Field
        label="Use limit (optional)"
        value={uses}
        onChangeText={setUses}
        keyboardType="number-pad"
      />
      <Button
        label="Create invite"
        actionIcon="add"
        disabled={action.busy}
        onPress={() =>
          void action.run(
            () =>
              groupService.invite(
                g.id,
                Number(days),
                uses.trim() ? Number(uses) : null,
              ),
            (i) => {
              setFresh(i);
              action.setMessage(
                "Invitation ready. Copy or share it before leaving this screen.",
              );
            },
          )
        }
      />
      {fresh && !revoked.includes(fresh.id) ? (
        <Panel>
          <Field
            label="Your invite code"
            value={fresh.code}
            editable={false}
            selectTextOnFocus
          />
          <Body>
            Expires:{" "}
            {fresh.expires_at
              ? new Date(fresh.expires_at).toLocaleString()
              : "No expiration"}
          </Body>
          <Button
            label="Copy code"
            actionIcon="copy"
            disabled={action.busy}
            onPress={() =>
              void action.run(
                async () => {
                  const Clipboard = await import("expo-clipboard").catch(() => {
                    throw new Error(
                      "Copy is unavailable in this development build. Use Share code, or rebuild the app to enable copying.",
                    );
                  });
                  if (!(await Clipboard.setStringAsync(fresh.code)))
                    throw new Error("Copy failed. Select the code to copy it.");
                },
                () => action.setMessage("Invite code copied."),
              )
            }
          />
          <Button
            label="Share code"
            actionIcon="share"
            disabled={action.busy}
            onPress={() =>
              void action.run(async () => {
                const result = await Share.share({
                  message: `Join ${g.name} on Roam. Enter this invitation code in Groups → Join with Code:\n${fresh.code}`,
                });
                if (result.action === Share.sharedAction)
                  action.setMessage(
                    "Invitation shared. Your friend can use the code to join.",
                  );
              })
            }
          />
        </Panel>
      ) : null}
      <Body>Invitations</Body>
      {[
        ...(fresh && !invites.some((i) => i.id === fresh.id) ? [fresh] : []),
        ...invites,
      ].map((i) => (
        <Panel key={i.id}>
          <Body>
            {i.revoked_at || revoked.includes(i.id)
              ? "Revoked"
              : i.expires_at && new Date(i.expires_at) <= new Date()
                ? "Expired"
                : i.max_uses !== null && i.use_count >= i.max_uses
                  ? "Fully used"
                  : "Available"}{" "}
            · {i.use_count}
            {i.max_uses === null ? " uses" : ` / ${i.max_uses} uses`}
          </Body>
          <Body>
            Expires:{" "}
            {i.expires_at
              ? new Date(i.expires_at).toLocaleString()
              : "No expiration"}
          </Body>
          {!i.revoked_at && !revoked.includes(i.id) ? (
            <Button
              label={`Revoke invitation ${i.id.slice(0, 8)}`}
              danger
              disabled={action.busy}
              onPress={() =>
                void action.run(
                  () => groupService.revoke(g.id, i.id),
                  () => {
                    setRevoked((v) => [...v, i.id]);
                    if (fresh?.id === i.id) setFresh(null);
                    action.setMessage("Invitation revoked.");
                  },
                )
              }
            />
          ) : null}
        </Panel>
      ))}
      {!invites.length && !fresh ? <Body>No invites yet.</Body> : null}
      <Button
        secondary
        label="Refresh invites"
        disabled={action.busy}
        onPress={() =>
          void action.run(
            () => groupService.get(g.id),
            (updated) => {
              if (updated.owner_id !== g.owner_id) {
                refresh();
                return;
              }
              setInvites(updated.invites);
              if (
                fresh &&
                updated.invites.some((i) => i.id === fresh.id && i.revoked_at)
              )
                setFresh(null);
              action.setMessage("Invitation status refreshed.");
            },
          )
        }
      />
      <Feedback action={action} />
    </>
  );
}
function GroupMemberRow({
  member,
  viceId,
}: {
  member: GroupDetails["members"][number];
  viceId?: string | null;
}) {
  const { colors, type } = useRoamTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <PlayerAvatar name={member.display_name} />
      <View style={{ flex: 1 }}>
        <Text style={[type.headline, { color: colors.textPrimary }]}>
          {member.display_name}
        </Text>
        <Body>
          {member.role === "owner"
            ? "Owner"
            : member.user_id === viceId
              ? "Vice owner"
              : "Member"}
        </Body>
      </View>
    </View>
  );
}

function JoinSession() {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const action = useAction();
  return (
    <Panel>
      <Button
        secondary
        label={open ? "Hide game code" : "Have a game code?"}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <>
          <Body>Enter the game code from your host.</Body>
          <Field
            label="Game code"
            value={id}
            onChangeText={setId}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!action.busy}
          />
          <Button
            label="Join game"
            disabled={action.busy || !id.trim()}
            onPress={() =>
              void action.run(
                () => sessionService.join(id.trim()),
                (session) => router.push(`/session/${session.id}`),
              )
            }
          />
          <Feedback action={action} />
        </>
      ) : null}
    </Panel>
  );
}
