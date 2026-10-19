import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/storeRedemptions.ts imports "server-only" and calls
// createSupabaseAdminClient()/createSupabaseRequestClient(), so the two
// RPC-calling/DB-reading functions cannot be invoked directly in a plain
// node:test run -- these are covered via source inspection.
// isMissingStoreRedemptionsTableError()'s own behavioural tests live in
// lib/supabase/storeRedemptionErrors.test.ts, against the pure module it
// actually lives in; this file only confirms the re-export exists.

const SOURCE = readFileSync("lib/supabase/storeRedemptions.ts", "utf8");

test("re-exports isMissingStoreRedemptionsTableError from the pure, independently-tested storeRedemptionErrors module, rather than redefining it", () => {
  assert.match(
    SOURCE,
    /export \{ isMissingStoreRedemptionsTableError \} from "@\/lib\/supabase\/storeRedemptionErrors";/,
  );
});

test("requestStoreRedemption() calls the RPC through the LEARNER'S OWN request-scoped client, never the service-role admin client", () => {
  const fn = SOURCE.slice(
    SOURCE.indexOf("export async function requestStoreRedemption"),
    SOURCE.indexOf("export async function getLearnerStoreRedemptions"),
  );
  assert.match(fn, /const supabase = await createSupabaseRequestClient\(\);/);
  assert.doesNotMatch(fn, /createSupabaseAdminClient/);
  assert.match(fn, /supabase\.rpc\("request_store_redemption", \{/);
  assert.match(fn, /p_catalogue_item_id: catalogueItemId,/);
  assert.match(fn, /p_idempotency_key: idempotencyKey,/);
});

test("getLearnerStoreRedemptions() reads via the admin client filtered by an explicit, already-resolved learnerAuthUserId, and always throws on error rather than returning an ambiguous empty array", () => {
  const fn = SOURCE.slice(
    SOURCE.indexOf("export async function getLearnerStoreRedemptions"),
    SOURCE.indexOf("export async function isStoreRedemptionAvailable"),
  );
  assert.match(fn, /const supabase = createSupabaseAdminClient\(\);/);
  assert.match(fn, /\.from\("store_redemptions"\)/);
  assert.match(fn, /\.eq\("learner_id", learnerAuthUserId\)/);
  assert.match(fn, /if \(error\) throw error;/);
  assert.doesNotMatch(fn, /catch/);
});

test("isStoreRedemptionAvailable() is read-only display logic -- it never writes to store_settings", () => {
  const fn = SOURCE.slice(
    SOURCE.indexOf("export async function isStoreRedemptionAvailable"),
    SOURCE.indexOf("export type AdminDeclineStoreRedemptionFailureCode"),
  );
  assert.match(fn, /\.from\("store_settings"\)/);
  assert.doesNotMatch(fn, /\.update\(|\.insert\(|\.upsert\(/);
});

test("adminDeclineStoreRedemption() also uses the request-scoped client, never the admin client, matching the RPC's own auth.uid()-based design", () => {
  const fn = SOURCE.slice(SOURCE.indexOf("export async function adminDeclineStoreRedemption"));
  assert.match(fn, /const supabase = await createSupabaseRequestClient\(\);/);
  assert.doesNotMatch(fn, /createSupabaseAdminClient/);
  assert.match(fn, /supabase\.rpc\("admin_decline_store_redemption", \{/);
});

test("Stage B1 audit correction: ALREADY_PENDING_FOR_ITEM is a recognised failure code, mapped from the RPC's own raised message", () => {
  assert.match(SOURCE, /"ALREADY_PENDING_FOR_ITEM"/);
  assert.match(SOURCE, /ALREADY_PENDING_FOR_ITEM: "ALREADY_PENDING_FOR_ITEM",/);
});

test("no learner id is ever passed as a parameter to either RPC call -- both resolve the caller from auth.uid() alone", () => {
  assert.doesNotMatch(SOURCE, /p_learner_id/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
