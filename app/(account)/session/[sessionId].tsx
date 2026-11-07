import { RoamDialog } from "../../../src/presentation/brand/overlays";
import { useCallback, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../src/platform/auth/AuthProvider";
import { sessionService } from "../../../src/platform/sessions/service";
import {
  sessionActions,
  statusLabels,
} from "../../../src/platform/sessions/permissions";
import { gameRegistry } from "../../../src/platform/games/registry";
import { useAccountResource } from "../../../src/platform/sessions/useAccountResource";
import {
  Body,
  Button,
  ErrorState,
  Field,
  Loading,
  Panel,
  Screen,
} from "../../../src/presentation/brand/forms";
export default function SessionRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const id = typeof sessionId === "string" ? sessionId : "";
  return <SessionDetailsScreen key={id} sessionId={id} />;
}
function SessionDetailsScreen({ sessionId }: { sessionId: string }) {
  const auth = useAuth();
  const load = useCallback(() => sessionService.get(sessionId), [sessionId]);
  const resource = useAccountResource(load);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const running = useRef(false);
  const session = resource.data;
  const game = session ? gameRegistry.get(session.game_type_id) : undefined;
  const actions = session
    ? sessionActions(session, auth.session?.user.id ?? "", game)
    : null;
  async function perform(action: () => Promise<unknown>, leave = false) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirm(false);
      if (leave) router.replace("/games");
      else resource.refresh();
    } catch {
      setError(
        "This action could not be completed. The game may have changed. Refresh and try again.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  if (session?.game_type_id === "secret_santa" && "settings" in session)
    return (
      <Redirect href={`/game/secret_santa/lobby/${session.id}` as never} />
    );
  return (
    <Screen title={session?.name ?? "Game details"} backTo="/games">
      <Button label="Back to Games" onPress={() => router.replace("/games")} />
      {resource.loading ? <Loading label="Loading game…" /> : null}
      {resource.error ? (
        <ErrorState message={resource.error} retry={resource.refresh} />
      ) : null}
      {session && actions ? (
        <>
          <Panel>
            <Body>{game?.metadata.name ?? "Unavailable game"}</Body>
            <Body>Status: {statusLabels[session.status]}</Body>
            <Body>Host: {session.host.display_name}</Body>
            <Body>Created {new Date(session.created_at).toLocaleString()}</Body>
            <Body>{session.participant_count} participants</Body>
            <Field
              label="Game code to share with players"
              value={session.id}
              editable={false}
              selectTextOnFocus
            />
            {session.group_id ? (
              <Button
                label="View group"
                onPress={() =>
                  router.push(`/group/${session.group_id}` as never)
                }
              />
            ) : null}
          </Panel>
          <Panel>
            <Body>Participants</Body>
            {session.participants.map((member) => (
              <Body key={member.id}>
                {member.display_name}
                {member.role === "host" ? " · Host" : ""}
              </Body>
            ))}
          </Panel>
          {actions.edit ? (
            <Panel>
              <Field
                label="Game name"
                value={name ?? session.name}
                onChangeText={setName}
                editable={!busy}
              />
              <Button
                label="Save changes"
                disabled={busy}
                onPress={() =>
                  void perform(() =>
                    sessionService.update({
                      sessionId: session.id,
                      gameTypeId: session.game_type_id,
                      name: name ?? session.name,
                      configuration: session.configuration,
                    }),
                  )
                }
              />
            </Panel>
          ) : null}
          {actions.openLobby ? (
            <Panel>
              <Body>
                {session.group_id
                  ? "Group members can join with the game code."
                  : "Anyone signed in with the code can join."}
              </Body>
              <Button
                label="Open lobby"
                disabled={busy}
                onPress={() =>
                  void perform(() => sessionService.openLobby(session.id))
                }
              />
            </Panel>
          ) : null}
          {actions.start ? (
            <Button
              label="Start game"
              disabled={busy}
              onPress={() =>
                void perform(() => sessionService.start(session.id))
              }
            />
          ) : null}
          {actions.leave ? (
            <Button
              label="Leave game"
              disabled={busy}
              onPress={() =>
                void perform(() => sessionService.leave(session.id), true)
              }
            />
          ) : null}
          {actions.cancel ? (
            <Panel>
              <Button
                label="Cancel game"
                danger
                disabled={busy}
                onPress={() => setConfirm(true)}
              />
              <RoamDialog
                visible={confirm}
                title="Cancel this game?"
                message="Cancel this game for everyone? This can’t be undone."
                kind="destructive"
                busy={busy}
                error={error ?? undefined}
                confirmLabel="Confirm cancellation"
                cancelLabel="Keep game"
                onConfirm={() =>
                  perform(() => sessionService.cancel(session.id))
                }
                onCancel={() => setConfirm(false)}
              />
            </Panel>
          ) : null}
        </>
      ) : null}
      {error && !confirm ? (
        <ErrorState message={error} retry={resource.refresh} />
      ) : null}
    </Screen>
  );
}
