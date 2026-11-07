import { useRoamTheme } from "../brand/theme";
import { Body } from "../brand/forms";
export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dateOnly?: boolean;
  disabled?: boolean;
};
export function DateField({
  label,
  value,
  onChange,
  dateOnly,
  disabled,
}: DateFieldProps) {
  const { colors } = useRoamTheme();
  const display = dateOnly
    ? value
    : value
      ? new Date(
          new Date(value).getTime() -
            new Date(value).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <>
      <Body>{label}</Body>
      <input
        aria-label={label}
        type={dateOnly ? "date" : "datetime-local"}
        value={display}
        disabled={disabled}
        style={{
          fontSize: 17,
          padding: 14,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          color: colors.textPrimary,
          background: colors.surface,
          minHeight: 48,
        }}
        onChange={(e) => {
          const v = e.target.value;
          if (v) onChange(dateOnly ? v : new Date(v).toISOString());
        }}
      />
    </>
  );
}
