// Canonical, pure due-date validation for Coin-eligible linked
// lesson+activity pairs. Shared so a new due-date requirement is never
// re-implemented per subject -- every activity creation/update route
// (currently only Business Studies has one; any future subject route
// should import this too) validates through the same function.
//
// Locked policy: a linked lesson/activity pair must not be publishable
// without a valid due date. This rejects null, undefined, "", whitespace-
// only, and malformed/invalid dates -- not merely `typeof === "string"`.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DueDateValidationResult =
  | { valid: true; dueDate: string }
  | {
      valid: false;
      reason: "missing" | "blank" | "invalid_format" | "invalid_date";
    };

export function validateRequiredDueDate(value: unknown): DueDateValidationResult {
  if (typeof value !== "string") {
    return { valid: false, reason: "missing" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, reason: "blank" };
  }

  if (!DATE_ONLY_PATTERN.test(trimmed)) {
    return { valid: false, reason: "invalid_format" };
  }

  if (Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) {
    return { valid: false, reason: "invalid_date" };
  }

  return { valid: true, dueDate: trimmed };
}
