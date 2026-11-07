import type { Configuration, ConfigurationSchema } from "./types";
export function validateConfiguration(
  schema: ConfigurationSchema,
  value: unknown,
): Configuration {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Configuration must be an object.");
  const input = value as Record<string, unknown>;
  for (const key of schema.required)
    if (!Object.hasOwn(input, key))
      throw new Error(`Missing configuration: ${key}.`);
  for (const [key, entry] of Object.entries(input)) {
    if (!Object.hasOwn(schema.properties, key))
      throw new Error(`Unknown configuration: ${key}.`);
    const rule = schema.properties[key];
    if (
      rule.type === "integer" &&
      (typeof entry !== "number" ||
        !Number.isSafeInteger(entry) ||
        (rule.minimum !== undefined && entry < rule.minimum) ||
        (rule.maximum !== undefined && entry > rule.maximum))
    )
      throw new Error(`Invalid configuration: ${key}.`);
    if (
      rule.type === "string" &&
      (typeof entry !== "string" ||
        (rule.minLength !== undefined && [...entry].length < rule.minLength) ||
        (rule.maxLength !== undefined && [...entry].length > rule.maxLength))
    )
      throw new Error(`Invalid configuration: ${key}.`);
    if (rule.type === "boolean" && typeof entry !== "boolean")
      throw new Error(`Invalid configuration: ${key}.`);
  }
  return { ...input } as Configuration;
}
