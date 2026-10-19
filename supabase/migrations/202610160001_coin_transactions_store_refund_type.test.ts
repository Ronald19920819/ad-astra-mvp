import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This migration cannot be executed against a real database in a plain
// node:test run -- these tests verify the SQL source text directly
// (mirroring this codebase's established source-inspection convention,
// e.g. supabase/migrations/202609150001_teacher_teaching_overview_rpc.test.ts's
// own header comment).

const SOURCE = readFileSync(
  "supabase/migrations/202610160001_coin_transactions_store_refund_type.sql",
  "utf8",
);

test("a new, dedicated 'store_redemption_refund' transaction type is added -- never repurposing 'correction' or 'admin_adjustment'", () => {
  assert.match(SOURCE, /'store_redemption_refund'/);
  assert.match(SOURCE, /drop constraint if exists coin_transactions_transaction_type_check;/);
});

test("all eight pre-existing transaction types are preserved in the rebuilt check constraint, not dropped", () => {
  for (const type of [
    "lesson_activity_reward",
    "admin_adjustment",
    "store_redemption",
    "ad_astra_contribution",
    "correction",
    "competition_award",
    "promotional_award",
    "special_achievement",
  ]) {
    assert.match(SOURCE, new RegExp(`'${type}'`));
  }
});

test("a store_redemption_refund row must always reference the original transaction it reverses, exactly as 'correction' already requires", () => {
  assert.match(
    SOURCE,
    /check \(\s*\n\s*transaction_type <> 'store_redemption_refund'\s*\n\s*or reference_transaction_id is not null\s*\n\s*\);/,
  );
});
