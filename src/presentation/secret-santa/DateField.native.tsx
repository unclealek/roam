import { useState } from "react";
import { Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Body, Button } from "../brand/forms";
import type { DateFieldProps } from "./DateField";
export function DateField({
  label,
  value,
  onChange,
  dateOnly,
  disabled,
}: DateFieldProps) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const date = dateOnly ? new Date(`${value}T12:00:00`) : new Date(value);
  const change = (d: Date) =>
    onChange(
      dateOnly
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : d.toISOString(),
    );
  return (
    <>
      <Body>{label}</Body>
      <Button
        label={`${label}: ${dateOnly ? value : date.toLocaleString()}`}
        disabled={disabled}
        onPress={() => setMode("date")}
      />
      {!dateOnly ? (
        <Button
          label={`Change ${label.toLowerCase()} time`}
          disabled={disabled}
          onPress={() => setMode("time")}
        />
      ) : null}
      {mode ? (
        <DateTimePicker
          accessibilityLabel={label}
          value={date}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, d) => {
            if (Platform.OS !== "ios") setMode(null);
            if (event.type !== "dismissed" && d) change(d);
          }}
        />
      ) : null}
      {mode && Platform.OS === "ios" ? (
        <Button
          label={`Done choosing ${label.toLowerCase()}`}
          onPress={() => setMode(null)}
        />
      ) : null}
    </>
  );
}
