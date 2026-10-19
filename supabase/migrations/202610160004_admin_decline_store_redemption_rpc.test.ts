import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE = readFileSync(
  "supabase/migrations/202610160004_admin_decline_store_redemption_rpc.sql",
  "utf8",
);
const fnBody = SOURCE.slice(
  SOURCE.indexOf("create or replace function public.admin_decline_store_redemption("),
  SOURCE.indexOf("$$;") + 3,
);

test("administrator status is re-verified inside the function itself, mirroring admin_adjust_learner_coins()'s own check exactly", () => {
  assert.match(
    fnBody,
    /join public\.teacher_profiles\s*\n\s*on teacher_profiles\.profile_id = profiles\.id\s*\n\s*where profiles\.auth_user_id = v_admin_id\s*\n\s*and profiles\.role = 'teacher'\s*\n\s*and teacher_profiles\.status = 'active'\s*\n\s*and teacher_profiles\.is_administrator = true/,
  );
  assert.match(fnBody, /raise exception 'ADMINISTRATOR_REQUIRED'/);
});

test("a refund can only ever be issued once -- a redemption not currently 'pending' (or already refunded) is rejected before any write", () => {
  assert.match(
    fnBody,
    /if v_current_status <> 'pending' or v_existing_refund_transaction_id is not null then\s*\n\s*raise exception 'REDEMPTION_NOT_PENDING'/,
  );
});

test("the target redemption row is locked (SELECT ... FOR UPDATE) before its status is checked, so a concurrent second decline call cannot race past the same check", () => {
  assert.match(
    fnBody,
    /from public\.store_redemptions\s*\n\s*where id = p_redemption_id\s*\n\s*for update;/,
  );
});

test("the refund amount always equals the original deducted coin_cost -- no other amount can ever be supplied", () => {
  assert.doesNotMatch(fnBody, /p_amount|p_coin_cost/);
  assert.match(fnBody, /v_new_balance := v_current_balance \+ v_coin_cost;/);
  assert.match(fnBody, /v_learner_id, v_coin_cost, 'store_redemption_refund', p_reason,/);
});

test("the refund transaction references the original deduction, and the status/refund-reference are updated together in one atomic statement", () => {
  assert.match(fnBody, /v_deduction_transaction_id, jsonb_build_object\('redemptionId', p_redemption_id\)/);
  assert.match(
    fnBody,
    /update public\.store_redemptions\s*\n\s*set status = p_new_status,\s*\n\s*refund_transaction_id = v_transaction_id,\s*\n\s*reviewed_at = now\(\),\s*\n\s*reviewed_by = v_admin_id,\s*\n\s*updated_at = now\(\)\s*\n\s*where id = p_redemption_id;/,
  );
});

test("only 'declined' or 'cancelled' are accepted as the new status -- never silently accepting an arbitrary string", () => {
  assert.match(fnBody, /if p_new_status not in \('declined', 'cancelled'\) then/);
  assert.match(fnBody, /raise exception 'UNSUPPORTED_STATUS'/);
});

test("a reason is required, matching the existing admin_adjust_learner_coins() REASON_REQUIRED convention", () => {
  assert.match(
    fnBody,
    /if p_reason is null or length\(trim\(p_reason\)\) = 0 then\s*\n\s*raise exception 'REASON_REQUIRED'/,
  );
});

test("the same per-learner advisory lock key is used as every other Coin-writing RPC in this codebase", () => {
  assert.match(fnBody, /perform pg_advisory_xact_lock\(hashtext\(v_learner_id::text\)\);/);
});

test("is SECURITY DEFINER with search_path locked to '', and is NOT yet called from any Next.js route (verified separately against app/api)", () => {
  assert.match(SOURCE, /security definer\s*\nset search_path = ''\s*\nas \$\$/);
  assert.match(
    SOURCE,
    /grant execute on function public\.admin_decline_store_redemption\(uuid, text, text\) to authenticated;/,
  );
});

test("no historical coin_transactions row is ever updated or deleted -- only a new compensating row is ever inserted", () => {
  assert.doesNotMatch(fnBody, /update public\.coin_transactions/);
  assert.doesNotMatch(fnBody, /delete from public\.coin_transactions/);
  const insertCount = (fnBody.match(/insert into public\.coin_transactions/g) ?? []).length;
  assert.equal(insertCount, 1);
});
