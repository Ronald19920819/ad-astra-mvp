import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE = readFileSync(
  "supabase/migrations/202610160002_store_redemptions.sql",
  "utf8",
);

test("store_settings defaults redemptions_enabled to false, and is seeded that way -- no code in this migration opens the Store", () => {
  assert.match(SOURCE, /redemptions_enabled boolean not null default false/);
  assert.match(
    SOURCE,
    /insert into public\.store_settings \(id, redemptions_enabled\)\s*\nvalues \(1, false\)/,
  );
});

test("store_settings has no select/write grant for anon or authenticated -- only service-role code and the SECURITY DEFINER RPC can reach it", () => {
  assert.match(SOURCE, /revoke all on table public\.store_settings from anon, authenticated;/);
  assert.doesNotMatch(SOURCE, /grant \w+ on table public\.store_settings to (anon|authenticated)/);
});

test("store_redemptions snapshots provider/value/Coin cost rather than re-reading the live catalogue later", () => {
  assert.match(SOURCE, /provider text not null check \(provider in \('KFC', 'Mr D SnackMe'\)\)/);
  assert.match(SOURCE, /rand_value integer not null check \(rand_value > 0\)/);
  assert.match(SOURCE, /coin_cost integer not null check \(coin_cost > 0\)/);
});

test("the deduction reference is NOT NULL (Coins are deducted immediately at request time) but the refund reference is nullable", () => {
  assert.match(
    SOURCE,
    /deduction_transaction_id uuid not null references public\.coin_transactions\(id\) on delete restrict,/,
  );
  assert.match(
    SOURCE,
    /refund_transaction_id uuid null references public\.coin_transactions\(id\) on delete restrict,/,
  );
});

test("a refund reference can only coexist with a declined/cancelled status -- an approved/fulfilled request can never carry one", () => {
  assert.match(
    SOURCE,
    /check \(\s*\n\s*refund_transaction_id is null\s*\n\s*or status in \('declined', 'cancelled'\)\s*\n\s*\),/,
  );
});

test("idempotency is enforced at the database level via a unique (learner_id, idempotency_key) index, not only inside the RPC", () => {
  assert.match(
    SOURCE,
    /create unique index if not exists store_redemptions_idempotency_idx\s*\n\s*on public\.store_redemptions \(learner_id, idempotency_key\);/,
  );
});

test("a learner cannot have two simultaneously pending requests for the same catalogue item -- enforced by a partial unique index", () => {
  assert.match(
    SOURCE,
    /create unique index if not exists store_redemptions_one_pending_per_item_idx\s*\n\s*on public\.store_redemptions \(learner_id, catalogue_item_id\)\s*\n\s*where status = 'pending';/,
  );
});

test("RLS is enabled, and only a SELECT policy scoped to the caller's own learner_id exists -- no insert/update/delete policy for authenticated", () => {
  assert.match(SOURCE, /alter table public\.store_redemptions enable row level security;/);
  assert.match(
    SOURCE,
    /create policy "Learners can read their own redemption requests"\s*\n\s*on public\.store_redemptions\s*\n\s*for select\s*\n\s*to authenticated\s*\n\s*using \(\(select auth\.uid\(\)\) = learner_id\);/,
  );
  assert.doesNotMatch(SOURCE, /for (insert|update|delete)\s*\n\s*to authenticated/);
});

test("no voucher code or guardian contact column exists yet", () => {
  assert.doesNotMatch(SOURCE, /voucher_code/i);
  assert.doesNotMatch(SOURCE, /guardian_phone|guardian_email|guardian_contact/i);
});

test("no store_catalogue_items table is created -- the catalogue stays a static TypeScript config in Stage B", () => {
  assert.doesNotMatch(SOURCE, /create table.*store_catalogue/i);
});
