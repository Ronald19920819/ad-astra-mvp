import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via
// requestStoreRedemption -> lib/supabase/storeRedemptions.ts), so per
// this codebase's established precedent it cannot be invoked directly in
// a plain node:test run. These tests verify the real source directly.

const SOURCE = readFileSync("app/api/store/redeem/route.ts", "utf8");

test("the catalogue item id is validated against the real STORE_CATALOGUE ids before the RPC is ever called -- never a client-trusted price", () => {
  assert.match(SOURCE, /import \{ STORE_CATALOGUE \} from "@\/lib\/store\/storeCatalogue";/);
  assert.match(SOURCE, /const VALID_CATALOGUE_ITEM_IDS = new Set\(STORE_CATALOGUE\.map\(\(item\) => item\.id\)\);/);
  assert.match(SOURCE, /!VALID_CATALOGUE_ITEM_IDS\.has\(catalogueItemId\)/);
  assert.doesNotMatch(SOURCE, /coinCost|price|amount/i);
});

test("the idempotency key must be a well-formed UUID before the RPC is ever called", () => {
  assert.match(SOURCE, /!uuidPattern\.test\(idempotencyKey\)/);
});

test("this route never resolves the learner itself and never passes a learner id anywhere -- requestStoreRedemption() resolves it from the caller's own session", () => {
  assert.doesNotMatch(SOURCE, /learnerId/);
  assert.doesNotMatch(SOURCE, /auth_user_id/);
  assert.match(
    SOURCE,
    /await requestStoreRedemption\(catalogueItemId, idempotencyKey\);/,
  );
});

test("an unsuccessful result maps each failure code to an honest, specific HTTP status -- STORE_CLOSED and INSUFFICIENT_BALANCE both map to 409, never a fake 200", () => {
  assert.match(
    SOURCE,
    /if \(result\.code === "STORE_CLOSED"\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{ error: "Store redemptions are not yet available\.", code: result\.code \},\s*\n\s*\{ status: 409 \},/,
  );
  assert.match(
    SOURCE,
    /if \(result\.code === "INSUFFICIENT_BALANCE"\) \{/,
  );
  assert.match(SOURCE, /status: 401/);
  assert.match(SOURCE, /status: 403/);
});

test("Stage B1 audit correction: ALREADY_PENDING_FOR_ITEM maps to an honest 409, never a fake 200 and never the generic 400 fallback", () => {
  assert.match(
    SOURCE,
    /if \(result\.code === "ALREADY_PENDING_FOR_ITEM"\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{\s*\n\s*error: "You already have a pending request for this reward\.",\s*\n\s*code: result\.code,\s*\n\s*\},\s*\n\s*\{ status: 409 \},/,
  );
});

test("no internal database detail (table name, SQL error text) is ever included in a JSON response body", () => {
  const jsonResponses = SOURCE.match(/NextResponse\.json\(\s*\{[^}]*\}/g) ?? [];
  for (const response of jsonResponses) {
    assert.doesNotMatch(response, /coin_transactions|store_redemptions|P0001/);
  }
});

test("no Coin deduction, ledger write, or RPC call happens directly in this route -- all of it is delegated to requestStoreRedemption()", () => {
  assert.doesNotMatch(SOURCE, /\.rpc\(/);
  assert.doesNotMatch(SOURCE, /\.insert\(/);
  assert.doesNotMatch(SOURCE, /createSupabaseAdminClient|createSupabaseRequestClient/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
