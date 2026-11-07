// Match the deliberately narrow check in the Scope 07.6 migration.
const explicitThreat = /^kill all (jews|muslims|gays)$/i;

export function checkSafetyText(value: string) {
  if (explicitThreat.test(value.trim().replace(/ +/g, " ")))
    throw new Error("Please remove explicit threats from this text.");
}
