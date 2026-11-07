import { checkSafetyText } from "../safety/content";

export function normalizeDisplayName(input: string): string {
  const name = input.trim();
  if (!name || [...name].length > 50 || /[\u0000-\u001f\u007f]/u.test(name)) {
    throw new Error(
      "Use 1–50 characters without line breaks or control characters.",
    );
  }
  checkSafetyText(name);
  return name;
}
