import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE = readFileSync(
  "supabase/migrations/202610160003_request_store_redemption_rpc.sql",
  "utf8",
);
const fnBody = SOURCE.slice(
  SOURCE.indexOf("create or replace function public.request_store_redemption("),
  SOURCE.indexOf("$$;") + 3,
);

test("the learner is resolved exclusively from auth.uid() -- there is no p_learner_id parameter at all, so a client can never request on another learner's behalf", () => {
  assert.match(
    fnBody,
    /create or replace function public\.request_store_redemption\(\s*\n\s*p_catalogue_item_id text,\s*\n\s*p_idempotency_key uuid\s*\n\)/,
  );
  assert.doesNotMatch(fnBody, /p_learner_id/);
  assert.match(fnBody, /v_learner_id := auth\.uid\(\);/);
});

test("an unauthenticated caller (null auth.uid()) is rejected before any table is read", () => {
  assert.match(
    fnBody,
    /if v_learner_id is null then\s*\n\s*raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'P0001';/,
  );
});

test("active learner status is re-verified inside the function itself, via the same profiles/learner_profiles join used elsewhere in this codebase", () => {
  assert.match(
    fnBody,
    /join public\.learner_profiles\s*\n\s*on learner_profiles\.profile_id = profiles\.id\s*\n\s*where profiles\.auth_user_id = v_learner_id\s*\n\s*and profiles\.role = 'learner'\s*\n\s*and learner_profiles\.status = 'active'/,
  );
  assert.match(fnBody, /raise exception 'ACTIVE_LEARNER_REQUIRED'/);
});

test("the Coin cost/provider/value come from a server-side allowlist keyed on the catalogue item id -- never a client-supplied price", () => {
  assert.match(fnBody, /case p_catalogue_item_id/);
  assert.match(fnBody, /when 'kfc-r100' then\s*\n\s*v_provider := 'KFC'; v_rand_value := 100; v_coin_cost := 10000;/);
  assert.match(fnBody, /when 'mrd-snackme-r100' then\s*\n\s*v_provider := 'Mr D SnackMe'; v_rand_value := 100; v_coin_cost := 10000;/);
  assert.match(fnBody, /raise exception 'UNKNOWN_CATALOGUE_ITEM'/);
  assert.doesNotMatch(fnBody, /p_coin_cost|p_amount|p_price/);
});

test("Store availability (store_settings.redemptions_enabled) is checked INSIDE this function, defaulting closed on a missing/null row", () => {
  assert.match(
    fnBody,
    /select redemptions_enabled into v_redemptions_enabled\s*\n\s*from public\.store_settings\s*\n\s*where id = 1;/,
  );
  assert.match(
    fnBody,
    /if coalesce\(v_redemptions_enabled, false\) is not true then\s*\n\s*raise exception 'STORE_CLOSED'/,
  );
});

test("the same per-learner advisory lock key as admin_adjust_learner_coins() is used, serialising concurrent writes for this learner", () => {
  assert.match(fnBody, /perform pg_advisory_xact_lock\(hashtext\(v_learner_id::text\)\);/);
});

test("the balance is computed live via SUM(amount) over coin_transactions -- never a cached/materialised column -- and insufficient balance is rejected before any insert", () => {
  assert.match(
    fnBody,
    /select coalesce\(sum\(amount\), 0\) into v_current_balance\s*\n\s*from public\.coin_transactions\s*\n\s*where learner_id = v_learner_id;/,
  );
  assert.match(fnBody, /v_new_balance := v_current_balance - v_coin_cost;/);
  assert.match(fnBody, /if v_new_balance < 0 then\s*\n\s*raise exception 'INSUFFICIENT_BALANCE'/);
});

test("exactly one negative coin_transactions row (transaction_type='store_redemption') is inserted, and the resulting redemption row links to it via deduction_transaction_id", () => {
  const insertCount = (fnBody.match(/insert into public\.coin_transactions/g) ?? []).length;
  assert.equal(insertCount, 1, "expected exactly one ledger insert in the non-idempotent path");
  assert.match(fnBody, /v_learner_id, -v_coin_cost, 'store_redemption',/);
  assert.match(
    fnBody,
    /insert into public\.store_redemptions \(\s*\n\s*learner_id, catalogue_item_id, provider, rand_value, coin_cost,\s*\n\s*status, deduction_transaction_id, idempotency_key\s*\n\s*\) values \(\s*\n\s*v_learner_id, p_catalogue_item_id, v_provider, v_rand_value, v_coin_cost,\s*\n\s*'pending', v_transaction_id, p_idempotency_key\s*\n\s*\)/,
  );
});

test("idempotency: a retried call with an already-used (learner, idempotency_key) pair returns the original result instead of inserting again", () => {
  assert.match(
    fnBody,
    /select sr\.id, sr\.deduction_transaction_id, sr\.status\s*\n\s*into v_existing_redemption_id, v_existing_transaction_id, v_existing_status\s*\n\s*from public\.store_redemptions sr\s*\n\s*where sr\.learner_id = v_learner_id\s*\n\s*and sr\.idempotency_key = p_idempotency_key;/,
  );
  assert.match(fnBody, /if v_existing_redemption_id is not null then/);

  // The idempotency lookup must happen AFTER the advisory lock is
  // acquired, so a genuinely concurrent retry can never race past it
  // twice.
  const lockIndex = fnBody.indexOf("pg_advisory_xact_lock");
  const idempotencyLookupIndex = fnBody.indexOf("sr.idempotency_key = p_idempotency_key");
  assert.ok(lockIndex < idempotencyLookupIndex, "the advisory lock must be acquired before the idempotency lookup");
});

test("is SECURITY DEFINER with search_path locked to '', and is granted to authenticated (not merely callable by service-role)", () => {
  assert.match(SOURCE, /security definer\s*\nset search_path = ''\s*\nas \$\$/);
  assert.match(
    SOURCE,
    /grant execute on function public\.request_store_redemption\(text, uuid\) to authenticated;/,
  );
});

test("no historical coin_transactions row is ever updated or deleted -- the function only ever inserts", () => {
  assert.doesNotMatch(fnBody, /update public\.coin_transactions/);
  assert.doesNotMatch(fnBody, /delete from public\.coin_transactions/);
});

// STAGE B1 AUDIT CORRECTION (B1): a new idempotency key for an item the
// learner already has 'pending' used to reach the final INSERT
// unhandled and surface a raw 23505 unique-violation. Now rejected
// explicitly, with a clean, documented error code.
test("a learner with an existing PENDING request for this exact catalogue item is rejected with a clean ALREADY_PENDING_FOR_ITEM error, before any balance check or insert", () => {
  assert.match(
    fnBody,
    /if exists \(\s*\n\s*select 1\s*\n\s*from public\.store_redemptions\s*\n\s*where learner_id = v_learner_id\s*\n\s*and catalogue_item_id = p_catalogue_item_id\s*\n\s*and status = 'pending'\s*\n\s*\) then\s*\n\s*raise exception 'ALREADY_PENDING_FOR_ITEM' using errcode = 'P0001';\s*\n\s*end if;/,
  );

  const duplicateCheckIndex = fnBody.indexOf("ALREADY_PENDING_FOR_ITEM");
  const balanceCheckIndex = fnBody.indexOf("v_new_balance := v_current_balance - v_coin_cost;");
  const insertIndex = fnBody.indexOf("insert into public.coin_transactions");
  assert.ok(
    duplicateCheckIndex < balanceCheckIndex && duplicateCheckIndex < insertIndex,
    "the duplicate-pending check must happen before the balance check and before any insert",
  );
});

test("the duplicate-pending check happens AFTER the advisory lock is acquired -- no race window between the check and the eventual insert", () => {
  const lockIndex = fnBody.indexOf("pg_advisory_xact_lock");
  const duplicateCheckIndex = fnBody.indexOf("ALREADY_PENDING_FOR_ITEM");
  assert.ok(lockIndex < duplicateCheckIndex, "the advisory lock must be acquired before the duplicate-pending check");
});

test("the duplicate-pending check happens AFTER the idempotency replay check -- a genuine retry of the SAME request must still succeed, never mistaken for a duplicate", () => {
  const idempotencyReturnIndex = fnBody.indexOf("return;");
  const duplicateCheckIndex = fnBody.indexOf("ALREADY_PENDING_FOR_ITEM");
  assert.ok(
    idempotencyReturnIndex < duplicateCheckIndex,
    "the idempotency early-return must be checked before the duplicate-pending check",
  );
});

test("the unique index remains the defence-in-depth backstop -- this correction does not remove or weaken store_redemptions_one_pending_per_item_idx", () => {
  const migrationSource = readFileSync("supabase/migrations/202610160002_store_redemptions.sql", "utf8");
  assert.match(
    migrationSource,
    /create unique index if not exists store_redemptions_one_pending_per_item_idx/,
  );
});
