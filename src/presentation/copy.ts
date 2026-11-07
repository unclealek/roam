/** Plain-language hints for the existing reward rules; no earning rules change. */
export function rewardHint(key: string, fallback: string) {
  const hints: Record<string, string> = {
    first_steps: "Complete your first game.",
    first_game: "Complete your first game.",
    three_sessions: "Join 3 games.",
    xp_500: "Earn 500 XP.",
    full_series: "Complete an activity series.",
    five_cards: "Collect 5 cards.",
    mind_reader: "Coming soon with Mind Match.",
    gift_detective: "Coming soon with Secret Santa activities.",
    mystery_solver: "Coming soon with Secret Agent.",
    dedicated_explorer: "Play 3 different games.",
  };
  return hints[key] ?? fallback;
}
