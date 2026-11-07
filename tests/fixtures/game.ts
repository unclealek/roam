import type { GameDefinition } from "../../src/platform/games/types";
import { validateConfiguration } from "../../src/platform/games/configuration";
export const fixtureSchema = {
  type: "object",
  properties: { rounds: { type: "integer", minimum: 1, maximum: 5 } },
  required: ["rounds"],
  additionalProperties: false,
} as const;
export const fixtureGame = {
  id: "engine_fixture",
  metadata: {
    name: "Engine fixture",
    description: "Developer-only engine test.",
    category: "Test",
    icon_ref: "test",
    min_players: 2,
    max_players: 4,
    availability_status: "available",
  },
  configurationSchema: fixtureSchema,
  routes: { details: "/game/engine_fixture", experience: null },
  operations: ["create", "open_lobby", "join", "leave", "start", "cancel"],
  validateConfiguration: (value: unknown) =>
    validateConfiguration(fixtureSchema, value),
} as const satisfies GameDefinition;
