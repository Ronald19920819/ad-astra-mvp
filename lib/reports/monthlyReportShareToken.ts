import { randomBytes } from "node:crypto";

// AD ASTRA MONTHLY REPORT -- STAGE 4C: PUBLIC REPORT LINK.
//
// Pure token generation -- no database, no Next.js, no "server-only"
// (node:crypto works anywhere Node runs, and this needs to stay directly
// unit-testable). 256 bits of entropy, base64url-encoded (URL-safe, no
// characters needing escaping in a link) -- large enough that
// guessing/enumerating it is infeasible regardless of how it is stored.
// See 202609060001_monthly_report_sharing.sql's own table comment for why
// this is stored raw rather than hashed (a resend must be able to reuse
// the SAME already-delivered link).
const TOKEN_BYTE_LENGTH = 32; // 256 bits of entropy

export function generateShareToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}
