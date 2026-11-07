export const reportReasons = {
  group: [
    ["inappropriate_group_content", "Inappropriate group name or description"],
    ["harassment", "Harassment or bullying"],
    ["spam_scam", "Spam or scam"],
    ["impersonation", "Impersonation"],
    ["privacy", "Privacy concern"],
    ["other", "Something else"],
  ],
  user: [
    ["offensive_display_name", "Offensive display name"],
    ["impersonation", "Impersonation"],
    ["harassment", "Harassment or bullying"],
    ["suspicious_behavior", "Spam or suspicious behavior"],
    ["privacy", "Privacy concern"],
    ["other", "Something else"],
  ],
} as const;

export type ReportTarget =
  | { type: "group"; groupId: string }
  | { type: "user"; groupId: string; userId: string; displayName: string };

export const reportDescriptionLimit = 1000;
export function reportDescription(value: string) {
  if ([...value].length > reportDescriptionLimit)
    throw new Error("Use 1,000 characters or fewer.");
  return value.trim() || null;
}
