// Pure error-classification helper, deliberately kept in its own module
// WITHOUT "server-only" (unlike lib/supabase/storeRedemptions.ts, which
// re-exports this) -- it does no I/O and must be genuinely unit-testable
// in a plain node:test run, not only verified via source inspection.

// PostgREST's own code for "this table isn't in the schema cache" -- the
// EXACT condition expected while Stage B's migrations
// (supabase/migrations/202610160002_store_redemptions.sql onward) have
// not yet been applied to a given environment. Exported so a caller
// (e.g. the Store page) can tell "the table genuinely doesn't exist yet"
// apart from any other, unrelated failure, and react to each honestly --
// the function that reads this table (getLearnerStoreRedemptions) still
// always throws on ANY error; it never silently swallows one into a
// fake success, and this classifier never suppresses an unrelated error
// either -- it only ever says yes/no to "is this specifically that one
// expected condition".
const MISSING_TABLE_ERROR_CODE = "PGRST205";

export function isMissingStoreRedemptionsTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return (
    code === MISSING_TABLE_ERROR_CODE &&
    typeof message === "string" &&
    message.includes("store_redemptions")
  );
}
