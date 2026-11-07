/** Original Roam geometry. 32-unit grid, rounded joins, no external icon paths. */
const star =
  '<path d="m16 8 2.5 5.2 5.7.8-4.1 4 .9 5.7-5-2.7-5 2.7.9-5.7-4.1-4 5.7-.8Z" fill="$accent"/>';
export const originalIcons = {
  home: {
    body: '<path d="M5 14 15 5a2 2 0 0 1 2 0l10 9v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" fill="$wash"/><path d="M12 28v-8a4 4 0 0 1 8 0v8M3 15 14 5a3 3 0 0 1 4 0l11 10"/><path d="m23 4 1-2 1 2 2 1-2 1-1 2-1-2-2-1Z" fill="$accent" stroke="none"/>',
  },
  groups: {
    body: '<path d="M3 25c0-5 4-8 8-8s8 3 8 8v3H7a4 4 0 0 1-4-3Z" fill="$wash"/><circle cx="11" cy="10" r="5" fill="$wash"/><circle cx="23" cy="12" r="4" fill="$accent"/><path d="M23 20c4 0 6 3 6 7M7 28h15M18 25c1-4 3-6 6-6"/>',
  },
  play: {
    body: '<path d="M9 7h14c3 0 5 3 6 7l1 8c.5 5-4 7-7 4l-4-3h-6l-4 3c-3 3-7 1-7-3l1-9c1-4 3-7 6-7Z" fill="$wash"/><path d="M9 12v8M5 16h8"/><circle cx="23" cy="13" r="1.4" fill="$ink" stroke="none"/><circle cx="26" cy="18" r="1.4" fill="$accent" stroke="none"/><path d="m16 11 3 5-3 5-3-5Z" fill="$accent" stroke="none"/>',
  },
  rewards: {
    body:
      '<path d="M8 5h16v9c0 6-3 10-8 10s-8-4-8-10Z" fill="$wash"/><path d="M8 8H3v5c0 4 3 6 7 6M24 8h5v5c0 4-3 6-7 6M16 24v4M10 29h12"/>' +
      '<path d="m16 8 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.6-3 1.6.5-3.5-2.5-2.5 3.5-.5Z" fill="$accent"/>',
  },
  profile: {
    body: '<path d="M27 10a13 13 0 1 1-8-7" fill="$wash"/><circle cx="15" cy="12" r="4" fill="$accent"/><path d="M7 25c1-5 4-7 8-7s7 2 8 7"/><path d="m25 2 1.4 3.6L30 7l-3.6 1.4L25 12l-1.4-3.6L20 7l3.6-1.4Z" fill="$accent" stroke="none"/>',
  },
  "secret-santa": {
    body: '<rect x="5" y="14" width="22" height="15" rx="4" fill="$wash"/><rect x="3" y="10" width="26" height="6" rx="2" fill="$wash"/><path d="M16 10v19M16 9C3 11 6-2 13 5l3 5c1-4 5-8 8-6 5 4-3 8-8 6Z" fill="$accent"/><path d="m25 2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill="$ink" stroke="none"/>',
  },
  "mind-match": {
    body: '<path d="M15 5c-4-4-9-1-9 4-5 1-5 7-2 10-2 5 2 9 7 8 1 4 5 3 5 0V8c0-2-1-3-1-3Z" fill="$wash"/><path d="M17 5c4-4 9-1 9 4 5 1 5 7 2 10 2 5-2 9-7 8-1 4-5 3-5 0" fill="$accent"/><path d="M6 10c4 0 5 3 5 5M4 19c4-2 7 0 7 4M26 10c-4 0-5 3-5 5M28 19c-4-2-7 0-7 4M12 7v3M20 7v3"/>',
  },
  "secret-agent": {
    body: '<path d="m7 12 3-8h12l3 8M4 13h24" fill="$wash"/><path d="M9 9h14"/><path d="m3 19 3-3h20l3 3-3 8H6Z" fill="$wash"/><circle cx="10" cy="21" r="4" fill="$accent"/><circle cx="22" cy="21" r="4" fill="$accent"/><path d="M14 20h4M13 29h6"/>',
  },
  points: {
    body:
      '<circle cx="16" cy="16" r="13" fill="$wash"/><circle cx="16" cy="16" r="9" stroke-dasharray="2 4"/>' +
      star,
  },
  levels: {
    body: '<path d="m4 18 12 7 12-7v7l-12 6-12-6Z" fill="$wash"/><path d="m4 10 12-7 12 7-12 7Z" fill="$accent"/><path d="m4 14 12 7 12-7M16 10v-7"/>',
  },
  streaks: {
    body: '<path d="M18 2c2 9 10 10 10 18a12 12 0 0 1-24 0c0-5 3-9 7-12-1 5 0 7 3 8 4-4 5-8 4-14Z" fill="$wash"/><path d="M16 17c1 3 5 4 5 8a5 5 0 0 1-10 0c0-3 3-5 5-8Z" fill="$accent"/>',
  },
  "first-game": {
    body: '<path d="M9 5v23M10 5c6-4 9 4 17 0v13c-8 4-11-4-17 0" fill="$wash"/><path d="m17 8 6 4-6 3Z" fill="$accent"/><path d="M5 28h10"/>',
  },
  "team-player": {
    body: '<circle cx="10" cy="10" r="4" fill="$wash"/><circle cx="22" cy="10" r="4" fill="$accent"/><path d="M2 26c0-6 3-10 8-10 3 0 5 1 6 4 1-3 3-4 6-4 5 0 8 4 8 10"/><path d="m11 24 5 5 5-5" fill="$accent"/>',
  },
  "mind-reader": {
    body: '<path d="M2 17c7-12 21-12 28 0-7 12-21 12-28 0Z" fill="$wash"/><circle cx="16" cy="17" r="5" fill="$accent"/><path d="m16 3 1 3M6 6l2 2M26 6l-2 2"/>',
  },
  "challenge-champion": {
    body: '<path d="m5 7 6 5 5-9 5 9 6-5-3 19H8Z" fill="$wash"/><path d="M9 21h14"/><path d="m16 12 3 4-3 4-3-4Z" fill="$accent"/>',
  },
  "game-night-legend": {
    body: '<path d="M22 3a13 13 0 1 0 7 19C15 26 7 11 22 3Z" fill="$wash"/><path d="m23 7 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="$accent"/>',
  },
  achievement: {
    body:
      '<path d="m10 20-3 10 9-4 9 4-3-10" fill="$wash"/><circle cx="16" cy="12" r="10" fill="$wash"/>' +
      star.replace("m16 8", "m16 4"),
  },
  trophy: {
    body: '<path d="M8 4h16v9c0 7-4 10-8 10s-8-3-8-10Z" fill="$wash"/><path d="M8 7H3v5c0 4 3 5 6 5M24 7h5v5c0 4-3 5-6 5M16 23v6M10 29h12"/><path d="m16 8 2 4 4 .5-3 3 .7 4-3.7-2-3.7 2 .7-4-3-3 4-.5Z" fill="$accent"/>',
  },
  chest: {
    body: '<path d="M4 15v-4c0-6 24-6 24 0v4" fill="$wash"/><rect x="3" y="14" width="26" height="15" rx="4" fill="$wash"/><path d="M9 8v21M23 8v21M3 19h26"/><rect x="13" y="16" width="6" height="8" rx="2" fill="$accent"/>',
  },
  challenge: {
    body: '<rect x="5" y="4" width="22" height="25" rx="6" fill="$wash"/><path d="M11 2v5M21 2v5M5 11h22"/><path d="m18 14-7 8h5l-2 6 8-9h-5Z" fill="$accent"/>',
  },
  history: {
    body: '<path d="M5 8a13 13 0 1 1-2 15M3 3v8h8" fill="$wash"/><path d="M16 9v8l5 3"/>',
  },
} as const;
export type RoamIconName = keyof typeof originalIcons;
export const navigationIconNames = [
  "home",
  "groups",
  "play",
  "rewards",
  "profile",
] as const;
export type IconVariant = "inactive" | "active" | "duotone" | "filled";
export function getIconSvg(
  name: RoamIconName,
  {
    ink = "#086BFF",
    wash = "#DCEEFF",
    accent = "#66B8FF",
    variant = "duotone",
    badge = false,
  }: {
    ink?: string;
    wash?: string;
    accent?: string;
    variant?: IconVariant;
    badge?: boolean;
  } = {},
) {
  const body = originalIcons[name].body
    .replaceAll("$ink", ink)
    .replaceAll("$wash", variant === "inactive" ? "none" : wash)
    .replaceAll(
      "$accent",
      variant === "inactive" ? "none" : variant === "filled" ? ink : accent,
    );
  const frame = badge
    ? `<path d="M16 1 28 7v10c0 7-7 12-12 14C11 29 4 24 4 17V7Z" fill="${wash}" stroke="${ink}" stroke-width="1.5"/><path d="M16 4 25 9v8c0 5-5 9-9 11-4-2-9-6-9-11V9Z" fill="none" stroke="${ink}" stroke-width=".5" opacity=".35"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${frame}<g fill="none" stroke="${ink}" stroke-width="${variant === "active" ? 2.5 : 2}" stroke-linecap="round" stroke-linejoin="round"${badge ? ' transform="translate(6 6) scale(.625)"' : ""}>${body}</g></svg>`;
}
export function resolveGameIcon(id: string): RoamIconName {
  return (
    (
      {
        secret_santa: "secret-santa",
        mind_match: "mind-match",
        secret_agent: "secret-agent",
      } as Record<string, RoamIconName>
    )[id] ?? "play"
  );
}
export function resolveAchievementIcon(id: string): RoamIconName {
  const key = id.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  return (
    (
      {
        first_game: "first-game",
        three_sessions: "team-player",
        xp_500: "levels",
        full_series: "challenge-champion",
        five_cards: "game-night-legend",
        first_game_completed: "first-game",
        first_steps: "first-game",
        team_player: "team-player",
        mind_reader: "mind-reader",
        secret_agent: "secret-agent",
        secret_mission_completed: "secret-agent",
        challenge_champion: "challenge-champion",
        game_night_legend: "game-night-legend",
        gift_detective: "secret-santa",
        mystery_solver: "secret-agent",
        dedicated_explorer: "game-night-legend",
      } as Record<string, RoamIconName>
    )[key] ?? "achievement"
  );
}
