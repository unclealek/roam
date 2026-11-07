/** Notification content supplies only an ID. Fetch the owned record before routing. */
export function notificationRoute(route: unknown): string | null {
  return typeof route === "string" &&
    (/^\/(session|group)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      route,
    ) ||
      route === "/notifications" ||
      route === "/rewards" ||
      /^\/(collectible|achievement)\/[a-z0-9][a-z0-9_-]{0,99}$/i.test(route))
    ? route
    : null;
}

/** A label for an already stored route. No secret content is derived here. */
export function notificationDestination(route: unknown) {
  const safe = notificationRoute(route);
  if (safe?.startsWith("/collectible/")) return "Collectible details";
  if (safe?.startsWith("/achievement/")) return "Achievement details";
  if (safe?.startsWith("/session/")) return "Game session";
  if (safe?.startsWith("/group/")) return "Group details";
  if (safe === "/rewards") return "Rewards";
  return "Notifications";
}

/** Resolve only the authenticated owner's fetched record, never raw push content. */
export function notificationTarget(notice: {
  route: unknown;
  template_key?: string;
  event_key?: string;
}) {
  const route = notificationRoute(notice.route);
  if (route !== "/rewards") return route;
  const card =
    notice.template_key === "reward_unlocked"
      ? /^card:([a-z0-9][a-z0-9_-]{0,99})$/i.exec(notice.event_key ?? "")
      : null;
  if (card) return `/collectible/${card[1]}`;
  const achievement =
    notice.template_key === "achievement_earned"
      ? /^achievement:([a-z0-9][a-z0-9_-]{0,99}):[a-z0-9_-]+$/i.exec(
          notice.event_key ?? "",
        )
      : null;
  if (achievement) return `/achievement/${achievement[1]}`;
  return route;
}
