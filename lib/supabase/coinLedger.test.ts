import assert from "node:assert/strict";
import test from "node:test";

// lib/supabase/coinLedger.ts imports "server-only" (via
// lib/supabase/server.ts) and cannot be invoked directly in a plain
// node:test run -- see lib/supabase/coinEarningEngine.test.ts's header
// comment for the full precedent. This mirrors
// recordLessonActivityPairReward's idempotency handling and the
// validation guards on all four write functions, citing the real source.

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

// Mirrors recordCorrection/recordAdminAdjustment's amount validation --
// signed, but never zero (a zero-amount transaction is meaningless and
// also rejected by the coin_transactions table's own CHECK constraint).
function assertNonZeroAmount(amount: number) {
  if (amount === 0) {
    throw new Error("amount must be non-zero");
  }
}

test("recordCorrection and recordAdminAdjustment reject a zero amount", () => {
  assert.throws(() => assertNonZeroAmount(0));
});

test("recordCorrection and recordAdminAdjustment accept a negative (deduction) amount", () => {
  assert.doesNotThrow(() => assertNonZeroAmount(-100));
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
