import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SOURCE = readFileSync(
  "supabase/migrations/202610160005_store_redemptions_status_idx.sql",
  "utf8",
);

test("adds an index on (status, requested_at desc) for an efficient future admin pending-redemption queue, not a partial index limited to 'pending' only", () => {
  assert.match(
    SOURCE,
    /create index if not exists store_redemptions_status_idx\s*\n\s*on public\.store_redemptions \(status, requested_at desc\);/,
  );
  assert.doesNotMatch(SOURCE, /where status = 'pending'/);
});

test("this migration only adds an index -- it creates no table, no column, no RPC, and drops nothing", () => {
  assert.doesNotMatch(SOURCE, /create table/i);
  assert.doesNotMatch(SOURCE, /alter table.*add column/i);
  assert.doesNotMatch(SOURCE, /create (or replace )?function/i);
  assert.doesNotMatch(SOURCE, /drop /i);
});

test("does not rewrite or duplicate any earlier Stage B migration's own content", () => {
  assert.doesNotMatch(SOURCE, /store_settings/);
  assert.doesNotMatch(SOURCE, /request_store_redemption/);
  assert.doesNotMatch(SOURCE, /admin_decline_store_redemption/);
});
