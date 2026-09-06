// AD ASTRA MONTHLY REPORT -- STAGE 4C: pure recipient validation/
// normalisation, shared by the send route and (for symmetry) directly
// testable without any server/database dependency. Deliberately
// permissive on format (a simple, standard local@domain.tld shape) --
// this is not trying to be a full RFC 5322 validator, just enough to
// reject obviously-malformed input before it reaches the email provider.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Sensible maximum to prevent abuse" -- generous enough for a genuine
// parent/guardian/mentor list, small enough that this can never become a
// bulk-mail vector.
export const MAX_CC_RECIPIENTS = 10;

export type NormalizedRecipients = {
  mainRecipient: string;
  ccRecipients: string[];
};

export type RecipientValidationResult =
  | { success: true; recipients: NormalizedRecipients }
  | { success: false; error: string };

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

// Trims, validates, deduplicates (case-insensitively), excludes the Main
// Recipient from the CC list (rather than rejecting the whole request --
// a teacher accidentally re-typing the same address is a UI mistake, not
// a reason to fail the send), and enforces the maximum CC count. Never
// mutates the caller's input.
export function normalizeAndValidateRecipients(input: {
  mainRecipient: unknown;
  ccRecipients: unknown;
}): RecipientValidationResult {
  if (typeof input.mainRecipient !== "string") {
    return { success: false, error: "A Main Recipient email address is required." };
  }
  const mainRecipient = input.mainRecipient.trim();
  if (!mainRecipient) {
    return { success: false, error: "A Main Recipient email address is required." };
  }
  if (!isValidEmail(mainRecipient)) {
    return { success: false, error: `"${mainRecipient}" is not a valid email address.` };
  }

  if (!Array.isArray(input.ccRecipients)) {
    return { success: false, error: "CC recipients must be a list of email addresses." };
  }
  if (!input.ccRecipients.every((value): value is string => typeof value === "string")) {
    return { success: false, error: "CC recipients must be a list of email addresses." };
  }

  const mainRecipientLower = mainRecipient.toLowerCase();
  const seen = new Set<string>();
  const ccRecipients: string[] = [];

  for (const rawValue of input.ccRecipients) {
    const trimmed = rawValue.trim();
    if (!trimmed) continue; // a blank "add another recipient" row -- ignore, not an error

    if (!isValidEmail(trimmed)) {
      return { success: false, error: `"${trimmed}" is not a valid email address.` };
    }

    const lower = trimmed.toLowerCase();
    if (lower === mainRecipientLower) continue; // never duplicate the Main Recipient in CC
    if (seen.has(lower)) continue; // deduplicate case-insensitively

    seen.add(lower);
    ccRecipients.push(trimmed);
  }

  if (ccRecipients.length > MAX_CC_RECIPIENTS) {
    return {
      success: false,
      error: `A report can be sent to at most ${MAX_CC_RECIPIENTS} CC recipients.`,
    };
  }

  return { success: true, recipients: { mainRecipient, ccRecipients } };
}
