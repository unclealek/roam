import { clearSantaInvitation } from "../../games/secret-santa/pending-invitation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useAuth } from "../../platform/auth/AuthProvider";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import { groupService } from "../../platform/groups/service";
import { santaService } from "../../games/secret-santa/service";
import type {
  SantaConfig,
  SantaLobby as Lobby,
  SantaPreview,
  SessionInvite,
} from "../../games/secret-santa/types";
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
import { RoamSheet, RoamDialog } from "../brand/overlays";
import { useFeedback } from "../brand/ToastFeedback";
import { successFeedback } from "../brand/feedback";
import { useRoamTheme } from "../brand/theme";
import { ProgressIndicator } from "../brand/ui";
import { validateSantaSettings } from "../../games/secret-santa/config";
import { sessionName } from "../../platform/sessions/validation";
import { SantaMoment, ParticipantIdentity } from "./SantaExperience";
import { DateField } from "./DateField";
const lobbyPath = (id: string) => `/game/secret_santa/lobby/${id}` as const;
function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const guard = useRef(false);
  async function run<T>(fn: () => Promise<T>, done?: (v: T) => void) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    try {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let v: T;
      try {
        v = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () =>
                reject(
                  new Error("No response yet. Refresh before trying again."),
                ),
              20000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      done?.(v);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Unable to complete this action. Please retry.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return { busy, message, run, setMessage };
}
function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      {action.busy ? <Loading label="Updating your lobby…" /> : null}
      {action.message ? <Body>{action.message}</Body> : null}
    </>
  );
}
const tomorrow = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString();
function defaults(): SantaConfig {
  return {
    joining_deadline: tomorrow(7),
    exchange_date: tomorrow(14).slice(0, 10),
    exchange_timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    currency_code: "EUR",
    identity_reveal_enabled: true,
    mind_match_enabled: false,
    secret_agent_enabled: false,
    secret_missions_enabled: false,
    max_participants: 100,
  };
}
function ConfigForm({
  initial,
  name: initialName,
  busy,
  onSave,
  label,
  groupPicker,
  groupLabel,
}: {
  groupPicker?: React.ReactNode;
  groupLabel?: string;
  initial?: SantaConfig;
  name?: string;
  busy: boolean;
  onSave: (name: string, c: SantaConfig) => void;
  label: string;
}) {
  const { colors, type } = useRoamTheme();
  const headingStyle = [type.title2, { color: colors.textPrimary }];
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState("");
  const [name, setName] = useState(initialName || "Secret Santa with Friends");
  const [c, setC] = useState<SantaConfig>(() =>
    initial
      ? (Object.fromEntries(
          Object.entries(initial).filter(
            ([k]) =>
              Object.keys(defaults()).includes(k) ||
              ["description", "budget_amount"].includes(k),
          ),
        ) as SantaConfig)
      : defaults(),
  );
  const change = <K extends keyof SantaConfig>(key: K, value: SantaConfig[K]) =>
    setC((v) => ({ ...v, [key]: value }));
  function advance() {
    try {
      sessionName(name);
      if (step >= 1) validateSantaSettings(c);
      setValidation("");
      setStep((v) => Math.min(3, v + 1));
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : "Check your settings.",
      );
    }
  }
  return (
    <>
      <Body>
        Step {step + 1} of 4 ·{" "}
        {["Your game", "Gift exchange", "Game activities", "Review"][step]}
      </Body>
      <ProgressIndicator current={step + 1} total={4} />
      {step === 0 ? (
        <>
          {groupPicker}
          <Panel>
            <Text style={headingStyle}>Your gathering</Text>
            <Field
              label="Game name"
              value={name}
              onChangeText={setName}
              editable={!busy}
            />
            <Field
              label="Description (optional)"
              value={c.description || ""}
              onChangeText={(v) => change("description", v)}
              editable={!busy}
            />
            <Field
              label="Maximum participants (3–100)"
              keyboardType="number-pad"
              value={String(c.max_participants)}
              onChangeText={(v) => change("max_participants", Number(v))}
              editable={!busy}
            />
          </Panel>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Panel>
            <Text style={headingStyle}>Save the dates</Text>
            <DateField
              label="Joining deadline"
              value={c.joining_deadline}
              onChange={(v) => change("joining_deadline", v)}
              disabled={busy}
            />
            <Body>Shown in your timezone.</Body>
            <DateField
              label="Gift exchange date"
              dateOnly
              value={c.exchange_date}
              onChange={(v) => change("exchange_date", v)}
              disabled={busy}
            />
            <Field
              label="Exchange timezone"
              value={c.exchange_timezone}
              onChangeText={(v) => change("exchange_timezone", v)}
              autoCapitalize="none"
              editable={!busy}
            />
          </Panel>
          <Panel>
            <Text style={headingStyle}>A thoughtful budget</Text>
            <Field
              label="Suggested gift budget (optional)"
              keyboardType="decimal-pad"
              value={c.budget_amount == null ? "" : String(c.budget_amount)}
              onChangeText={(v) =>
                change(
                  "budget_amount",
                  v.trim() ? Number(v.replace(",", ".")) : null,
                )
              }
              editable={!busy}
            />
            <Field
              label="Currency code"
              value={c.currency_code}
              onChangeText={(v) => change("currency_code", v.toUpperCase())}
              autoCapitalize="characters"
              editable={!busy}
            />
            <Body>Gift guide only. No payments in Roam.</Body>
          </Panel>
        </>
      ) : null}
      {step === 2 ? (
        <Panel>
          <Text style={headingStyle}>Make it your own</Text>
          {(
            [
              ["identity_reveal_enabled", "Identity reveal"],
              ["mind_match_enabled", "Mind Match"],
              ["secret_agent_enabled", "Discover the Secret Agent"],
              ["secret_missions_enabled", "Secret Missions"],
            ] as const
          ).map(([key, text]) => (
            <Button
              key={key}
              label={`${text}: ${c[key] ? "On" : "Off"}`}
              disabled={busy}
              onPress={() => change(key, !c[key])}
            />
          ))}
          <Body>
            Names are drawn when joining closes. The host can draw early.
          </Body>
        </Panel>
      ) : null}
      {step === 3 ? (
        <Panel>
          <Text style={headingStyle}>{name}</Text>
          <Body>{groupLabel}</Body>
          <Body>
            {c.description || "A secret gift exchange with your people."}
          </Body>
          <Body>
            Joining closes: {new Date(c.joining_deadline).toLocaleString()}
          </Body>
          <Body>
            Exchange: {c.exchange_date} · {c.exchange_timezone}
          </Body>
          <Body>
            Budget: {c.budget_amount ?? "No suggested amount"} {c.currency_code}
          </Body>
          <Body>Capacity: {c.max_participants} · minimum 3</Body>
          <Body>
            Identity reveal: {c.identity_reveal_enabled ? "On" : "Off"}
          </Body>
          <Body>
            Upcoming activities:{" "}
            {[
              [c.mind_match_enabled, "Mind Match"],
              [c.secret_agent_enabled, "Secret Agent"],
              [c.secret_missions_enabled, "Secret Missions"],
            ]
              .filter(([on]) => on)
              .map(([, name]) => name)
              .join(", ") || "None"}
            . Coming soon.
          </Body>
        </Panel>
      ) : null}
      {validation ? <ErrorState message={validation} /> : null}
      <Button
        label={busy ? "Creating game…" : step === 3 ? label : "Next"}
        disabled={busy}
        onPress={() => {
          if (step < 3) advance();
          else {
            try {
              sessionName(name);
              validateSantaSettings(c);
              setValidation("");
              onSave(name, c);
            } catch (error) {
              setValidation(
                error instanceof Error ? error.message : "Check your settings.",
              );
            }
          }
        }}
      />
      {step > 0 ? (
        <Button
          label="Previous step"
          secondary
          disabled={busy}
          onPress={() => {
            setValidation("");
            setStep(step - 1);
          }}
        />
      ) : null}
    </>
  );
}
export function SantaCreate() {
  const feedback = useFeedback();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const [group, setGroup] = useState<string | null>(
    typeof params.groupId === "string" ? params.groupId : null,
  );
  const groups = useAccountResource(groupService.list);
  const action = useAction();
  const request = useRef<{ key: string; fingerprint: string } | null>(null);
  return (
    <Screen title="Create Secret Santa">
      <ConfigForm
        groupLabel={
          group
            ? groups.data?.find((g) => g.id === group)?.name || "Selected group"
            : "Standalone game"
        }
        groupPicker={
          <Panel>
            <SantaHeading>Who’s coming?</SantaHeading>
            <Body>
              Choose a group or play without one. Friends join separately.
            </Body>
            <Button
              label={`${group === null ? "Selected: " : ""}Standalone game`}
              disabled={action.busy}
              onPress={() => setGroup(null)}
            />
            {groups.loading ? <Loading label="Loading your groups…" /> : null}
            {groups.error ? (
              <ErrorState message={groups.error} retry={groups.refresh} />
            ) : null}
            {groups.data?.map((g) => (
              <Button
                key={g.id}
                label={`${group === g.id ? "Selected: " : ""}${g.name}`}
                disabled={action.busy}
                onPress={() => setGroup(g.id)}
              />
            ))}
            {groups.data?.length === 0 ? (
              <Body>You can play without a group.</Body>
            ) : null}
          </Panel>
        }
        busy={action.busy}
        label="Create Game"
        onSave={(name, c) => {
          const fingerprint = JSON.stringify({ name, c, group });
          if (request.current?.fingerprint !== fingerprint)
            request.current = { key: randomUUID(), fingerprint };
          void action.run(
            () => santaService.create(name, c, request.current!.key, group),
            (v) => {
              feedback?.show({
                id: `santa-created-${v.id}`,
                message: "Game created. Invite your people!",
                kind: "success",
              });
              successFeedback();
              rememberInvitation(v.id, v.invitation);
              router.replace(lobbyPath(v.id));
            },
          );
        }}
      />
      <Feedback action={action} />
      <Button label="Back to Secret Santa" onPress={() => router.back()} />
    </Screen>
  );
}
// Codes are transient UI state, never persisted in tables, logs or routes for a host.
let freshInvitation: { id: string; invite: SessionInvite } | null = null;
function rememberInvitation(id: string, invite?: SessionInvite) {
  freshInvitation = invite ? { id, invite } : null;
}
export function SantaJoin() {
  useEffect(() => clearSantaInvitation(), []);
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(
    typeof params.code === "string" ? params.code : "",
  );
  const [preview, setPreview] = useState<SantaPreview | null>(null);
  const action = useAction();
  return (
    <Screen title={preview ? "You’re invited" : "Join Secret Santa"}>
      {preview ? (
        <>
          <Panel>
            <SantaHeading>{preview.name}</SantaHeading>
            <Body>{preview.participant_count} participants</Body>
            <Body>
              Joining closes{" "}
              {new Date(preview.joining_deadline).toLocaleString()}
            </Body>
            <Body>This invite joins only this game.</Body>
          </Panel>
          <Button
            label="Join Secret Santa"
            disabled={action.busy}
            onPress={() =>
              void action.run(
                () => santaService.redeem(code),
                (v) => router.replace(lobbyPath(v.id)),
              )
            }
          />
          <Button
            label="Use another invitation"
            disabled={action.busy}
            onPress={() => setPreview(null)}
          />
        </>
      ) : (
        <>
          <Field
            label="Invite code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            editable={!action.busy}
          />
          <Button
            label="Find game"
            disabled={action.busy || !code.trim()}
            onPress={() =>
              void action.run(() => santaService.preview(code), setPreview)
            }
          />
        </>
      )}
      <Feedback action={action} />
      <Button label="Back to Games" onPress={() => router.replace("/games")} />
    </Screen>
  );
}
function Countdown({
  deadline,
  serverNow,
}: {
  deadline: string;
  serverNow: string;
}) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const duration = Date.parse(deadline) - Date.parse(serverNow);
    const tick = () =>
      setRemaining(Math.max(0, duration - (Date.now() - start)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, serverNow]);
  const minutes = Math.ceil(remaining / 60000);
  return (
    <Body>
      {minutes > 0
        ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h ${minutes % 60}m until joining closes`
        : "Joining deadline reached. Refresh for the latest lobby status."}
    </Body>
  );
}
const phaseLabels = {
  joining_open: "Joining open",
  joining_closed: "Joining closed",
  ready_for_draw: "Ready for draw",
  insufficient_players: "Needs host attention",
  drawing: "Drawing names…",
  matched: "Game Started",
  draw_failed: "Draw needs attention",
};
export function SantaLobby() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  return <LobbyResource key={sessionId} id={sessionId} />;
}
function LobbyResource({ id }: { id: string }) {
  const load = useCallback(() => santaService.get(id), [id]);
  const r = useAccountResource(load, { retainOnRefresh: true });
  const action = useAction();
  const pendingRead = r.loading || r.refreshing;
  const refreshLobby = r.refresh;
  const refreshRef = useRef(refreshLobby);
  useEffect(() => {
    // Polling must not supersede a pending read before its deadline settles.
    refreshRef.current = () => {
      if (!pendingRead) refreshLobby();
    };
  }, [refreshLobby, pendingRead]);
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState === "active") refreshRef.current();
      }, 15000);
      const listener = AppState.addEventListener("change", (state) => {
        if (state === "active") refreshRef.current();
      });
      return () => {
        clearInterval(timer);
        listener.remove();
      };
    }, []),
  );
  return (
    <Screen title={r.data?.name || "Secret Santa lobby"}>
      {r.error && r.data ? (
        <ErrorState message={r.error} retry={r.refresh} />
      ) : null}
      {r.loading ? (
        <Loading label="Gathering your gift circle…" />
      ) : r.error && !r.data ? (
        <ErrorState message={r.error} retry={r.refresh} />
      ) : r.data && "settings" in r.data ? (
        <LobbyContent key={r.data.id} lobby={r.data} refresh={r.refresh} />
      ) : r.data ? (
        <Panel>
          <Body>
            {r.data.name} · {r.data.participant_count} participants
          </Body>
          <Body>Join the exchange to take part.</Body>
          <Button
            label="Join this Secret Santa"
            disabled={action.busy || !r.data.can_join}
            onPress={() =>
              void action.run(
                () => santaService.join(id),
                () => r.refresh(),
              )
            }
          />
          <Feedback action={action} />
        </Panel>
      ) : (
        <EmptyState
          title="Lobby unavailable"
          message="Check the invitation with your host."
        />
      )}
      <Button label="Refresh" secondary onPress={r.refresh} />
      <Button label="Back to Games" onPress={() => router.replace("/games")} />
    </Screen>
  );
}
function LobbyContent({
  lobby: l,
  refresh,
}: {
  lobby: Lobby;
  refresh: () => void;
}) {
  const feedback = useFeedback();
  const user = useAuth().session?.user.id;
  const host = user === l.host_id;
  const action = useAction();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<{
    text: string;
    fn: () => Promise<unknown>;
    leave?: boolean;
  } | null>(null);
  const [fresh, setFresh] = useState<SessionInvite | null>(() =>
    freshInvitation?.id === l.id ? freshInvitation.invite : null,
  );
  useEffect(() => {
    if (freshInvitation?.id === l.id) freshInvitation = null;
  }, [l.id]);
  const [extension, setExtension] = useState(tomorrow(2));
  const s = l.settings;
  const open =
    l.status === "lobby" &&
    s.lobby_phase === "joining_open" &&
    Date.parse(s.joining_deadline) > Date.parse(l.server_now);
  const activeCode =
    fresh &&
    !l.invitations.some((i) => i.id === fresh.id && i.revoked_at) &&
    Date.parse(fresh.expires_at) > Date.parse(l.server_now)
      ? fresh.code
      : null;
  const ask = (text: string, fn: () => Promise<unknown>, leave = false) =>
    setConfirm({ text, fn, leave });
  return (
    <>
      {s.lobby_phase === "matched" ? (
        <Panel>
          <SantaMoment kind="ready" />
          <Button
            label="Reveal My Recipient"
            onPress={() =>
              router.replace(`/game/secret_santa/recipient/${l.id}` as never)
            }
          />
          {s.recovery_required ? (
            <Body>
              Someone is unavailable. Contact your host. Names won’t be redrawn.
            </Body>
          ) : null}
        </Panel>
      ) : null}
      {s.lobby_phase === "drawing" ? <SantaMoment kind="drawing" /> : null}
      {s.lobby_phase === "ready_for_draw" ? (
        <Panel>
          <Body>
            Everyone’s in.{" "}
            {host
              ? "Your gift circle is ready for the draw."
              : "Waiting for your host to draw names."}
          </Body>
        </Panel>
      ) : null}
      {s.lobby_phase === "joining_closed" ? (
        <Panel>
          <Body>Joining is closed. Check back for the draw.</Body>
        </Panel>
      ) : null}
      {s.lobby_phase === "draw_failed" ? (
        <ErrorState
          message="The draw will retry automatically. Your recipient stays private."
          retry={refresh}
        />
      ) : null}
      <Panel>
        <SantaHeading>{l.name}</SantaHeading>
        <Body>Host: {l.host.display_name}</Body>
        <Body>
          Status:{" "}
          {l.status === "cancelled" ? "Cancelled" : phaseLabels[s.lobby_phase]}
        </Body>
        {s.description ? <Body>{s.description}</Body> : null}
        <Body>
          Gift exchange: {s.exchange_date} · {s.exchange_timezone}
        </Body>
        <Body>
          Joining deadline: {new Date(s.joining_deadline).toLocaleString()}
        </Body>
        {open ? (
          <Countdown deadline={s.joining_deadline} serverNow={l.server_now} />
        ) : null}
        <Body>
          Suggested budget:{" "}
          {s.budget_amount == null
            ? "No suggested amount"
            : `${s.budget_amount} ${s.currency_code}`}
        </Body>

        <Body>
          {l.participant_count} / {s.max_participants} participants · minimum 3
        </Body>
        <Body>Identity reveal: {s.identity_reveal_enabled ? "On" : "Off"}</Body>
        <Button
          label="Refresh lobby"
          disabled={action.busy}
          onPress={refresh}
        />
      </Panel>
      <Panel>
        <SantaHeading>Your gift circle</SantaHeading>
        {l.participants.map((p) => (
          <View key={p.id}>
            <ParticipantIdentity
              name={p.display_name}
              host={p.role === "host"}
            />
            {host && open && p.user_id !== l.host_id ? (
              <Button
                label={`Remove ${p.display_name}`}
                disabled={action.busy}
                danger
                onPress={() =>
                  ask(`Remove ${p.display_name} from this gift exchange?`, () =>
                    santaService.remove(l.id, p.user_id),
                  )
                }
              />
            ) : null}
          </View>
        ))}
        {l.participant_count < 3 ? (
          <Body>Invite at least 3 people to draw names.</Body>
        ) : null}
      </Panel>
      {host && open ? (
        <Panel>
          <SantaHeading>Invite friends</SantaHeading>
          <Body>
            For group games, join the group first. Then use this code.
          </Body>
          {activeCode ? (
            <>
              <Field
                label="Your invite code"
                value={activeCode}
                editable={false}
                selectTextOnFocus
              />
              <Button
                label="Copy code"
                disabled={action.busy}
                onPress={() =>
                  void action.run(
                    async () => {
                      if (!(await Clipboard.setStringAsync(activeCode)))
                        throw new Error(
                          "Copy failed. Select the code to copy it.",
                        );
                    },
                    () => {
                      successFeedback();
                      if (feedback)
                        feedback.show({
                          id: `santa-copy-${l.id}`,
                          message: "Invite code copied.",
                          kind: "success",
                        });
                      else action.setMessage("Invite code copied.");
                    },
                  )
                }
              />
              <Button
                label="Share invitation"
                disabled={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    const result = await Share.share({
                      message: `Join ${l.name} on Roam. Code: ${activeCode}\nroam://game/secret_santa/join?code=${activeCode}`,
                    });
                    action.setMessage(
                      result.action === Share.dismissedAction
                        ? "Sharing cancelled."
                        : "Invitation shared.",
                    );
                  })
                }
              />
            </>
          ) : (
            <Body>Lost your code? Create a new invite.</Body>
          )}
          <Button
            label="New invite"
            disabled={action.busy}
            onPress={() =>
              void action.run(() => santaService.invite(l.id), setFresh)
            }
          />
          {l.invitations
            .filter((i) => !i.revoked_at)
            .map((i) => (
              <Button
                key={i.id}
                label={`Revoke invitation ${i.id.slice(0, 8)}`}
                disabled={action.busy}
                onPress={() =>
                  ask("Revoke this invitation? It can no longer be used.", () =>
                    santaService.revoke(l.id, i.id),
                  )
                }
              />
            ))}
        </Panel>
      ) : null}
      {host && l.status === "lobby" && s.lobby_phase !== "drawing" ? (
        <Panel>
          <SantaHeading>Host controls</SantaHeading>
          {open ? (
            <>
              <Button
                label="Edit game settings"
                disabled={action.busy}
                onPress={() => setEdit(!edit)}
              />
              <Button
                label="Close joining early"
                disabled={action.busy}
                onPress={() =>
                  ask(
                    "Close joining and lock participants and settings? At least three participants are needed for readiness.",
                    () => santaService.close(l.id),
                  )
                }
              />
            </>
          ) : null}
          {s.lobby_phase === "insufficient_players" ||
          (s.lobby_phase === "joining_open" && !open) ? (
            <>
              <Body>You need 3 players. Extend joining or cancel.</Body>
              <DateField
                label="New joining deadline"
                value={extension}
                onChange={setExtension}
                disabled={action.busy}
              />
              <Button
                label="Extend joining deadline"
                disabled={action.busy}
                onPress={() =>
                  ask(
                    "Reopen joining until this deadline? Generate a fresh invitation after extending.",
                    () => santaService.extend(l.id, extension),
                  )
                }
              />
            </>
          ) : null}
          {(open || s.lobby_phase === "ready_for_draw") &&
          l.participant_count >= 3 ? (
            <Button
              label="Draw names"
              disabled={action.busy}
              onPress={() =>
                ask(
                  "Draw names for everyone? Joining will close permanently. Participants and settings will be locked. Each person receives one private recipient, and assignments cannot be rerolled.",
                  async () => {
                    const current = await santaService.get(l.id);
                    if (
                      !("settings" in current) ||
                      current.status !== "lobby" ||
                      current.participant_count < 3 ||
                      !["joining_open", "ready_for_draw"].includes(
                        current.settings.lobby_phase,
                      )
                    ) {
                      refresh();
                      throw new Error(
                        "The game has changed. Refresh and try again.",
                      );
                    }
                    return santaService.draw(l.id);
                  },
                )
              }
            />
          ) : null}
          {s.lobby_phase === "draw_failed" ? (
            <Body>Joining is closed. The draw will retry automatically.</Body>
          ) : null}
          <Button
            label="Cancel gift exchange"
            disabled={action.busy}
            danger
            onPress={() =>
              ask(
                "Cancel this gift exchange for everyone? This cannot be undone.",
                () => santaService.cancel(l.id),
              )
            }
          />
        </Panel>
      ) : null}
      {host && open && edit ? (
        <RoamSheet
          visible
          title="Edit game settings"
          busy={action.busy}
          onClose={() => setEdit(false)}
        >
          <ConfigForm
            key={s.updated_at}
            initial={s}
            name={l.name}
            busy={action.busy}
            label="Save changes"
            onSave={(name, c) =>
              void action.run(
                () => santaService.edit(l.id, name, c),
                () => {
                  setEdit(false);
                  refresh();
                },
              )
            }
          />
        </RoamSheet>
      ) : null}
      {!host && open ? (
        <Button
          label="Leave gift exchange"
          disabled={action.busy}
          danger
          onPress={() =>
            ask(
              "Leave this gift exchange? Your group membership stays unchanged.",
              () => santaService.leave(l.id),
              true,
            )
          }
        />
      ) : null}
      {confirm ? (
        <RoamDialog
          visible
          title={
            confirm.text.startsWith("Draw names")
              ? "Ready to draw names?"
              : "Confirm lobby action"
          }
          message={
            confirm.text.startsWith("Draw names")
              ? "Joining will close and everyone's secret assignment will be final. Assignments cannot be redrawn."
              : confirm.text
          }
          confirmLabel={
            confirm.text.startsWith("Draw names")
              ? "Start Draw"
              : "Confirm lobby action"
          }
          busy={action.busy}
          error={action.message || undefined}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            action.run(confirm.fn, () => {
              const leave = confirm.leave;
              setConfirm(null);
              if (leave) router.replace("/games");
              else refresh();
            })
          }
        >
          {action.busy && confirm.text.startsWith("Draw names") ? (
            <SantaMoment kind="drawing" />
          ) : null}
        </RoamDialog>
      ) : null}
      <Feedback action={action} />
    </>
  );
}
// Group-only presentation lives with the Phase 2 group screens.
export { SantaGroupLobbies } from "../groups/GroupLobbies";
function SantaHeading({ children }: { children: React.ReactNode }) {
  const { colors, type } = useRoamTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[type.title2, { color: colors.textPrimary }]}
    >
      {children}
    </Text>
  );
}
