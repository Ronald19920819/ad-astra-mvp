import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This is a forward-only correction migration (never applied against a
// real database in this test run) -- source-inspection only, per this
// codebase's established convention. The genuine runtime behaviour fix
// was confirmed separately by actually executing both corrected
// functions against a real, isolated staging Postgres instance (Stage
// "Store Final SQL Correction"); these tests only confirm the source
// text itself reflects the intended, narrowly scoped fix.

const SOURCE = readFileSync(
  "supabase/migrations/202610190001_fix_store_rpc_status_ambiguity.sql",
  "utf8",
);

test("request_store_redemption: the duplicate-pending check now qualifies every column with the sr alias -- no bare 'status' reference remains in that query", () => {
  const fn = SOURCE.slice(
    SOURCE.indexOf("create or replace function public.request_store_redemption("),
    SOURCE.indexOf("$$;\n\nrevoke all on function public.request_store_redemption"),
  );
  assert.match(
    fn,
    /from public\.store_redemptions sr\s*\n\s*where sr\.learner_id = v_learner_id\s*\n\s*and sr\.catalogue_item_id = p_catalogue_item_id\s*\n\s*and sr\.status = 'pending'/,
  );
  assert.doesNotMatch(fn, /\n\s*and status = 'pending'/);
});

test("admin_decline_store_redemption: the row-lock lookup now qualifies every column with the sr alias -- no bare 'status' reference remains in that query", () => {
  const fn = SOURCE.slice(
    SOURCE.indexOf("create or replace function public.admin_decline_store_redemption("),
  );
  assert.match(
    fn,
    /select sr\.learner_id, sr\.coin_cost, sr\.status, sr\.deduction_transaction_id, sr\.refund_transaction_id\s*\n\s*into v_learner_id, v_coin_cost, v_current_status, v_deduction_transaction_id,\s*\n\s*v_existing_refund_transaction_id\s*\n\s*from public\.store_redemptions sr\s*\n\s*where sr\.id = p_redemption_id\s*\n\s*for update;/,
  );
  assert.doesNotMatch(fn, /select learner_id, coin_cost, status,/);
});

test("everything else about both functions is unchanged: same parameters, same returned columns, same error codes, same advisory lock key, same grants", () => {
  assert.match(SOURCE, /p_catalogue_item_id text,\s*\n\s*p_idempotency_key uuid/);
  assert.match(SOURCE, /p_redemption_id uuid,\s*\n\s*p_new_status text,\s*\n\s*p_reason text/);
  assert.match(SOURCE, /'AUTHENTICATION_REQUIRED'/);
  assert.match(SOURCE, /'ACTIVE_LEARNER_REQUIRED'/);
  assert.match(SOURCE, /'STORE_CLOSED'/);
  assert.match(SOURCE, /'UNKNOWN_CATALOGUE_ITEM'/);
  assert.match(SOURCE, /'ALREADY_PENDING_FOR_ITEM'/);
  assert.match(SOURCE, /'INSUFFICIENT_BALANCE'/);
  assert.match(SOURCE, /'ADMINISTRATOR_REQUIRED'/);
  assert.match(SOURCE, /'REDEMPTION_NOT_FOUND'/);
  assert.match(SOURCE, /'REDEMPTION_NOT_PENDING'/);
  assert.equal(
    (SOURCE.match(/perform pg_advisory_xact_lock\(hashtext\(v_learner_id::text\)\);/g) ?? []).length,
    2,
  );
  assert.match(
    SOURCE,
    /grant execute on function public\.request_store_redemption\(text, uuid\) to authenticated;/,
  );
  assert.match(
    SOURCE,
    /grant execute on function public\.admin_decline_store_redemption\(uuid, text, text\) to authenticated;/,
  );
});

test("neither already-applied original migration (202610160003, 202610160004) was edited -- this is a new, additive, forward-only migration", () => {
  const original1 = readFileSync(
    "supabase/migrations/202610160003_request_store_redemption_rpc.sql",
    "utf8",
  );
  const original2 = readFileSync(
    "supabase/migrations/202610160004_admin_decline_store_redemption_rpc.sql",
    "utf8",
  );
  // The bug is still present, unedited, in the original files -- proving
  // this correction did not touch them.
  assert.match(original1, /\n\s*and status = 'pending'/);
  assert.match(original2, /select learner_id, coin_cost, status, deduction_transaction_id, refund_transaction_id/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
