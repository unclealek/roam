// Foreground UI policy only. Delivery, preferences and notification-list storage are unchanged.
let routeSuppressed = false;
let criticalOverlays = 0;
export function setForegroundRouteSuppressed(value: boolean) {
  routeSuppressed = value;
}
export function foregroundPresentationSuppressed() {
  return routeSuppressed || criticalOverlays > 0;
}
export function suspendForegroundPresentation() {
  criticalOverlays += 1;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      criticalOverlays = Math.max(0, criticalOverlays - 1);
    }
  };
}

/** Foreground feedback follows existing category switches; unknown categories stay silent. */
export function foregroundNoticeAllowed(
  category: string,
  preferences: Record<string, unknown>,
) {
  const allowed = [
    "group_updates",
    "game_updates",
    "your_turn",
    "secret_messages",
    "reminders",
    "rewards",
  ];
  return (
    allowed.includes(category) && preferences[`${category}_enabled`] === true
  );
}
