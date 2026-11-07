import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { santaService } from "../../games/secret-santa/service";
import type { SantaAssignment } from "../../games/secret-santa/types";
import { useAccountResource } from "../../platform/sessions/useAccountResource";
import {
  Body,
  Button,
  ErrorState,
  Loading,
  Panel,
  Screen,
} from "../brand/forms";
import { useRoamTheme } from "../brand/theme";
import { successFeedback } from "../brand/feedback";
import { MysteryGift, SantaMoment } from "./SantaExperience";
import { RewardMotion } from "../rewards/RewardMotion";

/** Date-only exchange countdown respects the exchange's calendar timezone. */
export function exchangeCountdown(date: string, timezone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (key: string) => parts.find((p) => p.type === key)?.value;
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
  return days > 0
    ? `${days} ${days === 1 ? "day" : "days"} until the exchange`
    : days === 0
      ? "Gift exchange is today!"
      : "Gift exchange date has passed";
}
export function SantaRecipient() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const load = useCallback(
    () => santaService.getMySecretSantaAssignment(sessionId),
    [sessionId],
  );
  const r = useAccountResource(load);
  // Hide sensitive UI while backgrounded, including the app switcher where possible.
  const [foreground, setForeground] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => sub.remove();
  }, []);
  return (
    <Screen title="My Recipient">
      {!foreground ? (
        <Body>Your recipient is hidden.</Body>
      ) : r.loading ? (
        <Loading label="Opening your recipient…" />
      ) : r.error ? (
        <ErrorState message={r.error} retry={r.refresh} />
      ) : r.data ? (
        <RecipientContent
          key={`${sessionId}:${r.data.revealed_at}`}
          assignment={r.data}
          refresh={r.refresh}
        />
      ) : (
        <Body>Your recipient isn’t ready yet. Check the lobby.</Body>
      )}
      <Button
        label="Back to lobby"
        onPress={() =>
          router.replace(`/game/secret_santa/lobby/${sessionId}` as never)
        }
      />
    </Screen>
  );
}
export function RecipientContent({
  assignment: initial,
  refresh,
}: {
  assignment: SantaAssignment;
  refresh: () => void;
}) {
  const { colors, type } = useRoamTheme();
  const guard = useRef(false);
  const [assignment, setAssignment] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), 60000);
    return () => clearInterval(timer);
  }, []);
  const s = assignment.settings;
  async function reveal() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError(false);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        santaService.reveal(assignment.session_id),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("timeout")), 20000);
        }),
      ]);
      setAssignment(result);
      if (result.recipient) successFeedback();
    } catch {
      setError(true);
    } finally {
      clearTimeout(timeout);
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {!assignment.recipient ? (
        <Panel>
          <SantaMoment kind="reveal" />
          <Body>Your recipient is ready.</Body>
          <Button
            label={busy ? "Opening your gift…" : "Reveal my recipient"}
            disabled={busy}
            onPress={() => void reveal()}
          />
          {error ? (
            <ErrorState
              message="Couldn’t reveal your recipient. Try again."
              retry={() => void reveal()}
            />
          ) : null}
        </Panel>
      ) : (
        <RewardMotion>
          <Panel>
            <Body>Your recipient</Body>
            <MysteryGift opened />

            <Text
              accessibilityRole="header"
              style={[type.largeTitle, { color: colors.brandPrimary }]}
            >
              {assignment.recipient.display_name}
            </Text>
            <Body>Only you can see this. Keep it secret.</Body>
            {!assignment.recipient.available || s.recovery_required ? (
              <Body>
                Someone is unavailable. Ask your host what to do. Names won’t be
                redrawn.
              </Body>
            ) : null}

            <Body>
              Gift exchange: {s.exchange_date} · {s.exchange_timezone}
            </Body>
            <Body>
              {exchangeCountdown(
                s.exchange_date,
                s.exchange_timezone,
                new Date(Date.parse(assignment.server_now) + elapsed),
              )}
            </Body>
            <Body>
              Suggested budget:{" "}
              {s.budget_amount == null
                ? "No suggested amount"
                : `${s.budget_amount} ${s.currency_code}`}
            </Body>

            {s.description ? <Body>{s.description}</Body> : null}
            <Button
              label="Continue"
              onPress={() =>
                router.replace(
                  `/game/secret_santa/lobby/${assignment.session_id}` as never,
                )
              }
            />
            <Button label="Refresh" onPress={refresh} />
          </Panel>
        </RewardMotion>
      )}
    </>
  );
}
