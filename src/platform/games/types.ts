export type Availability = "available" | "coming_soon" | "unavailable";
export type LifecycleOperation =
  "create" | "open_lobby" | "join" | "leave" | "start" | "cancel";
export type Configuration = Record<string, string | number | boolean>;
export type PropertySchema =
  | {
      readonly type: "integer";
      readonly minimum?: number;
      readonly maximum?: number;
    }
  | {
      readonly type: "string";
      readonly minLength?: number;
      readonly maxLength?: number;
    }
  | { readonly type: "boolean" };
/** Deliberately small, strict JSON Schema subset, enforced identically in PostgreSQL. */
export type ConfigurationSchema = {
  readonly type: "object";
  readonly properties: Readonly<Record<string, PropertySchema>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
};
export type GameMetadata = {
  name: string;
  description: string;
  category: string;
  icon_ref: string;
  min_players: number;
  max_players: number | null;
  availability_status: Availability;
};
export type GameDefinition = {
  readonly id: string;
  readonly metadata: GameMetadata;
  readonly configurationSchema: ConfigurationSchema;
  readonly routes: {
    readonly details: `/game/${string}`;
    readonly experience: `/game/${string}/${string}` | null;
  };
  readonly operations: readonly LifecycleOperation[];
  readonly validateConfiguration: (value: unknown) => Configuration;
};
