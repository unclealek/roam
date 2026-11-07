import { useState } from "react";
import { Keyboard, Pressable, Text } from "react-native";
import {
  reportDescriptionLimit,
  reportReasons,
  type ReportTarget,
} from "../../platform/safety/report";
import { submitReport } from "../../platform/safety/service";
import { Body, Button, ErrorState, Field } from "../brand/forms";
import { RoamSheet } from "../brand/overlays";
import { useRoamTheme } from "../brand/theme";
import { FunctionalIcon } from "../icons";

export function ReportSheet({
  target,
  onClose,
}: {
  target: ReportTarget;
  onClose: () => void;
}) {
  const { colors, type, radius } = useRoamTheme();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState(false);
  const tooLong = [...description].length > reportDescriptionLimit;

  async function send() {
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    try {
      await submitReport(target, reason, description);
      setReceived(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to send your report. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoamSheet
      visible
      title={
        target.type === "group" ? "Report this group" : "Report this member"
      }
      onClose={onClose}
      busy={busy}
      closeLabel={received ? "Done" : "Cancel"}
    >
      {received ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[type.body, { color: colors.textPrimary }]}
        >
          Report received. Thank you for helping keep Roam safe.
        </Text>
      ) : (
        <>
          <Body>
            {target.type === "group"
              ? "Let us know what's wrong with this group. Your report will remain private."
              : `Let us know what's wrong with ${target.displayName}. Your report will remain private.`}
          </Body>
          {reportReasons[target.type].map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: reason === value, disabled: busy }}
              disabled={busy}
              onPress={() => setReason(value)}
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: 10,
                minHeight: 44,
                padding: 10,
                borderRadius: radius.control,
                borderWidth: 1,
                borderColor:
                  reason === value ? colors.brandPrimary : colors.border,
                backgroundColor:
                  reason === value ? colors.paleBlue : colors.surface,
              }}
            >
              <Text style={[type.body, { color: colors.textPrimary, flex: 1 }]}>
                {label}
              </Text>
              {reason === value ? <FunctionalIcon name="check" /> : null}
            </Pressable>
          ))}
          <Field
            label="Explanation (optional, up to 1,000 characters)"
            multiline
            editable={!busy}
            value={description}
            onChangeText={setDescription}
            error={tooLong ? "Use 1,000 characters or fewer." : undefined}
          />
          {error ? <ErrorState message={error} /> : null}
          <Button
            label="Submit report"
            disabled={!reason || tooLong}
            loading={busy}
            onPress={send}
          />
        </>
      )}
    </RoamSheet>
  );
}
