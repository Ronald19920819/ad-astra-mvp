import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([learnerId]). Run this file explicitly, never via the standard glob
// runner:
//   node --import tsx "app/api/teacher/admin/coins/[learnerId]/adjust/route.test.ts"

const SOURCE = readFileSync(
  "app/api/teacher/admin/coins/[learnerId]/adjust/route.ts",
  "utf8",
);

// The POST handler is the only declaration in this file and its own
// multi-line destructured prop type would falsely terminate a naive
// [\s\S]*?\n\} regex -- see the established fix for this pattern
// elsewhere in this codebase -- so this slices to end-of-file.
const postFn = SOURCE.slice(SOURCE.indexOf("export async function POST("));

test("validates request shape (learnerId, adjustmentType, amount, category, reason) entirely BEFORE ever calling authorizeAdministrator() -- cheap rejection first", () => {
  const learnerIdCheckIndex = postFn.indexOf("uuidPattern.test(learnerId)");
  const amountCheckIndex = postFn.indexOf("amount <= 0");
  const authIndex = postFn.indexOf("await authorizeAdministrator()");
  assert.ok(learnerIdCheckIndex > -1 && amountCheckIndex > -1 && authIndex > -1);
  assert.ok(learnerIdCheckIndex < authIndex);
  assert.ok(amountCheckIndex < authIndex);
});

test("only 'add' or 'subtract' is accepted as adjustmentType -- the client can never submit a pre-signed amount or an arbitrary direction string", () => {
  assert.match(postFn, /if \(adjustmentType !== "add" && adjustmentType !== "subtract"\) \{/);
});

test("amount must be a positive integer, never zero, negative, a decimal, or NaN -- and is capped to prevent an abusive payload without an arbitrarily small limit", () => {
  assert.match(postFn, /!Number\.isInteger\(amount\)/);
  assert.match(postFn, /Number\.isNaN\(amount\)/);
  assert.match(postFn, /amount <= 0/);
  assert.match(postFn, /amount > MAX_AMOUNT/);
  assert.match(SOURCE, /const MAX_AMOUNT = 1_000_000;/);
});

test("category is restricted to exactly the five administrator-adjustable types -- lesson_activity_reward, store_redemption, and ad_astra_contribution can never be manually created here", () => {
  const categoriesBlock = SOURCE.match(/const ALLOWED_CATEGORIES:[\s\S]*?\];/)?.[0];
  assert.ok(categoriesBlock, "ALLOWED_CATEGORIES not found");
  assert.match(categoriesBlock!, /"admin_adjustment"/);
  assert.match(categoriesBlock!, /"correction"/);
  assert.match(categoriesBlock!, /"competition_award"/);
  assert.match(categoriesBlock!, /"promotional_award"/);
  assert.match(categoriesBlock!, /"special_achievement"/);
  assert.doesNotMatch(categoriesBlock!, /lesson_activity_reward|store_redemption|ad_astra_contribution/);
  assert.match(
    postFn,
    /!ALLOWED_CATEGORIES\.includes\(category as AdminAdjustableCoinTransactionType\)/,
  );
});

test("reason is mandatory (rejects blank/whitespace-only) with a length cap matching the ledger's own CHECK constraint", () => {
  assert.match(postFn, /!reason\.trim\(\)/);
  assert.match(postFn, /reason\.trim\(\)\.length > MAX_REASON_LENGTH/);
  assert.match(SOURCE, /const MAX_REASON_LENGTH = 500;/);
});

test("a correction requires a well-formed reference transaction id -- validated before authorization, matching the ledger's own CHECK constraint for this type", () => {
  const validationBlock = postFn.slice(
    postFn.indexOf('if (transactionType === "correction")'),
    postFn.indexOf("const authorization = await authorizeAdministrator();"),
  );
  assert.match(validationBlock, /uuidPattern\.test\(referenceTransactionId\)/);
  assert.match(validationBlock, /REFERENCE_TRANSACTION_REQUIRED/);
});

test("a correction's referenced transaction is independently re-verified to belong to this exact learner -- never trusted merely because the client sent a well-formed UUID", () => {
  assert.match(postFn, /\.eq\("id", resolvedReferenceTransactionId\)/);
  assert.match(postFn, /\.eq\("learner_id", learnerId\)/);
});

test("authorizes via the canonical authorizeAdministrator() helper before ever touching the learner or the ledger", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*authorizeAdministrator,\s*\n\s*teacherAuthorizationResponse,\s*\n\s*\} from "@\/lib\/supabase\/teacherAuth";/,
  );
  const authIndex = postFn.indexOf("await authorizeAdministrator()");
  const learnerLookupIndex = postFn.indexOf('.eq("auth_user_id", learnerId)');
  assert.ok(authIndex > -1 && learnerLookupIndex > -1 && authIndex < learnerLookupIndex);
});

test("confirms the learner actually exists (role='learner') before ever calling the RPC -- a guessed UUID that isn't a real learner is rejected as not found", () => {
  assert.match(postFn, /\.eq\("role", "learner"\)/);
  assert.match(postFn, /if \(!learnerProfile\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{ error: "Learner not found\.", code: "NOT_FOUND" \},/);
});

test("the signed amount is computed here, server-side, from adjustmentType + amount -- the client never submits it directly", () => {
  assert.match(postFn, /const signedAmount = adjustmentType === "add" \? amount : -amount;/);
  assert.match(postFn, /amount: signedAmount,/);
});

test("delegates the actual write to recordAdminCoinAdjustment (which itself calls the atomic RPC) -- this route never inserts into coin_transactions directly", () => {
  assert.match(
    SOURCE,
    /import \{\s*\n\s*recordAdminCoinAdjustment,\s*\n\s*type AdminAdjustableCoinTransactionType,\s*\n\s*\} from "@\/lib\/supabase\/coinLedger";/,
  );
  assert.match(postFn, /await recordAdminCoinAdjustment\(\{/);
  assert.doesNotMatch(SOURCE, /\.from\("coin_transactions"\)\.insert\(/);
});

test("an insufficient-balance rejection from the ledger becomes the exact required administrator-facing message and a 409 status", () => {
  const insufficientBlock = postFn.match(/if \(result\.code === "INSUFFICIENT_BALANCE"\) \{[\s\S]*?\n      \}/)?.[0];
  assert.ok(insufficientBlock, "INSUFFICIENT_BALANCE branch not found");
  assert.match(
    insufficientBlock!,
    /error: "This adjustment would reduce the learner's balance below 0 AC\.",/,
  );
  assert.match(insufficientBlock!, /status: 409/);
});

test("a successful adjustment returns the transaction id and the server-calculated new balance -- never echoes back a client-supplied balance", () => {
  assert.match(
    postFn,
    /return NextResponse\.json\(\{\s*\n\s*success: true,\s*\n\s*transactionId: result\.transactionId,\s*\n\s*newBalance: result\.newBalance,\s*\n\s*\}\);/,
  );
});

test("an unexpected error is caught, logged with context, and never leaks internal details to the response", () => {
  assert.match(postFn, /catch \(error\) \{/);
  assert.match(postFn, /console\.error\("Unable to record admin Coin adjustment:", \{ learnerId, error \}\);/);
});
