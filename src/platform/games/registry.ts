import { secretSanta } from "../../games/secret-santa";
import type { GameDefinition } from "./types";
export function createGameRegistry<const T extends readonly GameDefinition[]>(
  modules: T,
) {
  const entries = new Map<string, T[number]>();
  for (const game of modules) {
    if (entries.has(game.id)) throw new Error(`Duplicate game: ${game.id}`);
    entries.set(game.id, game);
  }
  return {
    all: (): readonly T[number][] => [...entries.values()],
    get: (id: string): T[number] | undefined => entries.get(id),
    require: (id: string): T[number] => {
      const game = entries.get(id);
      if (!game) throw new Error(`Unknown game: ${id}`);
      return game;
    },
  };
}
export const gameRegistry = createGameRegistry([secretSanta]);
export type GameRegistry = ReturnType<typeof createGameRegistry>;
