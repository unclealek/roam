import type { ConfigurationSchema } from "../../platform/games/types";
import { validateConfiguration } from "../../platform/games/configuration";

import currencies from "./currencies.json";
import type { SantaConfig } from "./types";
// Generic session configuration stays empty. Setup settings have their own typed,
// authorized record and validator below; no gameplay JSON is accepted.
export const configurationSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const satisfies ConfigurationSchema;
export const validateSecretSantaConfiguration = (value: unknown) =>
  validateConfiguration(configurationSchema, value);
export function validateSantaSettings(
  value: unknown,
  now = Date.now(),
): SantaConfig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Enter valid game settings.");
  const c = value as SantaConfig;
  const allowed = [
    "description",
    "joining_deadline",
    "exchange_date",
    "exchange_timezone",
    "budget_amount",
    "currency_code",
    "identity_reveal_enabled",
    "mind_match_enabled",
    "secret_agent_enabled",
    "secret_missions_enabled",
    "max_participants",
  ];
  if (Object.keys(c).some((k) => !allowed.includes(k)))
    throw new Error("Unknown game setting.");
  const deadline = Date.parse(c.joining_deadline);
  if (
    typeof c.joining_deadline !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(c.joining_deadline) ||
    !Number.isFinite(deadline) ||
    deadline <= now
  )
    throw new Error("Choose a joining deadline in the future.");
  let localDay: string;
  try {
    localDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: c.exchange_timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(deadline));
    if (!c.exchange_timezone) throw Error();
  } catch {
    throw new Error("Choose a valid IANA timezone.");
  }
  if (
    typeof c.exchange_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(c.exchange_date) ||
    !Number.isFinite(Date.parse(c.exchange_date)) ||
    new Date(c.exchange_date).toISOString().slice(0, 10) !== c.exchange_date ||
    c.exchange_date <= localDay
  )
    throw new Error("Gift exchange date must be after the joining deadline.");
  if (!currencies.includes(c.currency_code))
    throw new Error("Choose an ISO 4217 currency code, such as EUR.");
  if (
    c.budget_amount != null &&
    (!Number.isFinite(c.budget_amount) ||
      c.budget_amount <= 0 ||
      c.budget_amount >= 1e9 ||
      Math.abs(c.budget_amount * 100 - Math.round(c.budget_amount * 100)) >
        1e-6)
  )
    throw new Error("Enter a positive budget with up to two decimal places.");
  if (
    !Number.isInteger(c.max_participants) ||
    c.max_participants < 3 ||
    c.max_participants > 100
  )
    throw new Error("Choose a capacity from 3 to 100.");
  for (const k of [
    "identity_reveal_enabled",
    "mind_match_enabled",
    "secret_agent_enabled",
    "secret_missions_enabled",
  ] as const)
    if (typeof c[k] !== "boolean")
      throw new Error("Choose valid activity options.");
  if (
    c.description != null &&
    (typeof c.description !== "string" ||
      [...c.description].length > 1000 ||
      /[\x00-\x1f\x7f]/.test(c.description))
  )
    throw new Error("Use a description of up to 1,000 characters.");
  return {
    ...c,
    description: c.description?.trim() || null,
    joining_deadline: new Date(deadline).toISOString(),
  };
}
