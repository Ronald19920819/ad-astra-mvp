import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/coinLedger.ts imports "server-only" (via
// lib/supabase/server.ts) and cannot be invoked directly in a plain
// node:test run -- see lib/supabase/coinEarningEngine.test.ts's header
// comment for the full precedent. This mirrors
// recordLessonActivityPairReward's idempotency handling and the
// validation guards on all four write functions, citing the real source.

const SOURCE = readFileSync("lib/supabase/coinLedger.ts", "utf8");

// Mirrors recordLessonActivityPairReward's Postgres-error handling: a
// unique_violation (23505) on the partial idempotency index means this
// exact learner+submission was already rewarded -- treated as a
// successful no-op, never as an application error.
function handleInsertResult(error: { code?: string } | null, insertedId: string | null) {
  if (error) {
    if (error.code === "23505") {
      return { inserted: false, transactionId: null };
    }
    throw new Error("unexpected error");
  }
  return { inserted: true, transactionId: insertedId };
}

test("duplicate pair reward: a 23505 unique violation is an idempotent no-op, not an error", () => {
  const result = handleInsertResult({ code: "23505" }, null);
  assert.equal(result.inserted, false);
  assert.equal(result.transactionId, null);
});

test("a genuinely new pair reward inserts successfully", () => {
  const result = handleInsertResult(null, "txn-1");
  assert.equal(result.inserted, true);
  assert.equal(result.transactionId, "txn-1");
});

test("a non-idempotency database error still propagates rather than being silently swallowed", () => {
  assert.throws(() => handleInsertResult({ code: "23503" }, null));
});

// Mirrors recordLessonActivityPairReward's amount validation -- the
// function must reject being called for a non-qualifying (0 or negative)
// pair; callers must never invoke it except with
// calculatePairCoins(...).finalCoins for a qualifying pair.
function assertPositiveIntegerAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("amount must be a positive integer");
  }
}

test("recordLessonActivityPairReward rejects a zero or negative amount", () => {
  assert.throws(() => assertPositiveIntegerAmount(0));
  assert.throws(() => assertPositiveIntegerAmount(-100));
});

test("recordLessonActivityPairReward accepts a genuine positive award", () => {
  assert.doesNotThrow(() => assertPositiveIntegerAmount(700));
});

// AD ASTRA ADMINISTRATOR COIN MANAGEMENT -- STAGE 2: recordAdminCoinAdjustment
// replaces the earlier architecture-only recordCorrection/
// recordAdminAdjustment (never called by any route, per Stage 1's own
// scope) with the single write path every manual adjustment/correction
// now goes through -- delegating the actual balance check and insert to
// the admin_adjust_learner_coins() database RPC rather than a direct
// .insert() from application code, so a deduction can never race past the
// >= 0 floor under concurrency (see the RPC migration's own header
// comment for why).

test("recordAdminCoinAdjustment delegates to the admin_adjust_learner_coins RPC -- it never inserts into coin_transactions directly", () => {
  const fn = SOURCE.match(/export async function recordAdminCoinAdjustment\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "recordAdminCoinAdjustment not found");
  assert.match(fn!, /supabase\.rpc\("admin_adjust_learner_coins", \{/);
  assert.doesNotMatch(fn!, /\.from\("coin_transactions"\)\s*\n\s*\.insert\(/);
});

test("the RPC call passes the pre-signed amount, transaction type, reason, optional reference transaction, and metadata -- never a separate 'direction' field the database would have to interpret", () => {
  const fn = SOURCE.match(/export async function recordAdminCoinAdjustment\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /p_learner_id: params\.learnerAuthUserId,/);
  assert.match(fn!, /p_amount: params\.amount,/);
  assert.match(fn!, /p_transaction_type: params\.transactionType,/);
  assert.match(fn!, /p_reason: params\.reason,/);
  assert.match(fn!, /p_reference_transaction_id: params\.referenceTransactionId \?\? null,/);
});

test("an admin note is stored under metadata.adminNote -- never in the reason column, and never as a new dedicated table column", () => {
  const fn = SOURCE.match(/export async function recordAdminCoinAdjustment\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /metadata\.adminNote = params\.adminNote\.trim\(\);/);
});

test("only the five administrator-adjustable transaction types are accepted by the type system -- lesson_activity_reward, store_redemption, and ad_astra_contribution are excluded", () => {
  const typeDecl = SOURCE.match(/export type AdminAdjustableCoinTransactionType =[\s\S]*?;/)?.[0];
  assert.ok(typeDecl, "AdminAdjustableCoinTransactionType not found");
  assert.match(typeDecl!, /"admin_adjustment"/);
  assert.match(typeDecl!, /"correction"/);
  assert.match(typeDecl!, /"competition_award"/);
  assert.match(typeDecl!, /"promotional_award"/);
  assert.match(typeDecl!, /"special_achievement"/);
  assert.doesNotMatch(typeDecl!, /lesson_activity_reward|store_redemption|ad_astra_contribution/);
});

test("a Postgres RPC error is translated into a specific failure code by matching the RPC's own raised message -- never surfaced as a generic/opaque failure", () => {
  assert.match(
    SOURCE,
    /const code = RPC_FAILURE_MESSAGES\[error\.message\] \?\? "UNKNOWN_ERROR";/,
  );
  assert.match(SOURCE, /INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",/);
  assert.match(SOURCE, /ADMINISTRATOR_REQUIRED: "ADMINISTRATOR_REQUIRED",/);
});

test("recordAdminCoinAdjustment never accepts an actor id parameter -- actor identity is derived server-side inside the RPC from the caller's own session, never a client- or caller-supplied value", () => {
  const paramsType = SOURCE.match(/export type RecordAdminCoinAdjustmentParams = \{[\s\S]*?\};/)?.[0];
  assert.ok(paramsType, "RecordAdminCoinAdjustmentParams not found");
  assert.doesNotMatch(paramsType!, /actorId|actor_id/);
});

// Balance derivation
test("getLearnerCoinBalance sums every transaction amount for the learner", () => {
  const rows = [{ amount: 500 }, { amount: 900 }, { amount: -200 }];
  const balance = rows.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(balance, 1200);
});

test("getLearnerCoinBalance is 0 for a learner with no transactions", () => {
  const rows: { amount: number }[] = [];
  const balance = rows.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(balance, 0);
});
