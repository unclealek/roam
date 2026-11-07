import type { GameDefinition } from "../../platform/games/types";
import {
  configurationSchema,
  validateSecretSantaConfiguration,
} from "./config";
export const secretSanta = {
  id: "secret_santa",
  metadata: {
    name: "Secret Santa",
    description: "Exchange secret gifts and discover mysteries with friends.",
    category: "Social / Mystery",
    icon_ref: "gift",
    min_players: 3,
    max_players: 100,
    availability_status: "available",
  },
  configurationSchema,
  routes: {
    details: "/game/secret_santa",
    experience: "/game/secret_santa/create",
  },
  operations: ["create", "join", "leave", "cancel"],
  validateConfiguration: validateSecretSantaConfiguration,
} as const satisfies GameDefinition;
