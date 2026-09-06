import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" -- cannot be invoked directly in a
// plain node:test run, per this codebase's established precedent.

const SOURCE = readFileSync("lib/email/activityReviewEmailDeliveryRepository.ts", "utf8");

// export async function recordActivityReviewEmailDelivery's own inline
// parameter type spans multiple lines and closes with a bare "}" (as in
// "}): Promise<...> {") -- a naive [\s\S]*?\n\} regex would falsely
// terminate there instead of at the function's real end, so this slices
// to the next declaration instead.
function sliceFunction(startMarker: string, endMarker: string): string {
  const start = SOURCE.indexOf(startMarker);
  const end = SOURCE.indexOf(endMarker, start);
  assert.ok(start > -1 && end > start, `could not locate ${startMarker} .. ${endMarker}`);
  return SOURCE.slice(start, end);
}

test("recordActivityReviewEmailDelivery always INSERTs a new row -- never an update -- so this stays a genuine append-only audit trail", () => {
  const fn = sliceFunction(
    "export async function recordActivityReviewEmailDelivery(",
    "export async function listActivityReviewEmailDeliveriesForSubmission(",
  );
  assert.match(fn, /\.insert\(\{/);
  assert.doesNotMatch(fn, /\.update\(/);
});

test("status is constrained to the three-value workflow -- sent, failed, skipped", () => {
  assert.match(SOURCE, /export type ActivityReviewEmailDeliveryStatus = "sent" \| "failed" \| "skipped";/);
});

test("optional reason/providerMessageId default to null rather than undefined, matching the database column defaults", () => {
  const fn = sliceFunction(
    "export async function recordActivityReviewEmailDelivery(",
    "export async function listActivityReviewEmailDeliveriesForSubmission(",
  );
  assert.match(fn, /reason: input\.reason \?\? null,/);
  assert.match(fn, /provider_message_id: input\.providerMessageId \?\? null,/);
});

test("listActivityReviewEmailDeliveriesForSubmission is scoped to exactly one submission and orders newest first -- it is not a blanket/reconciliation query", () => {
  const fn = SOURCE.match(/export async function listActivityReviewEmailDeliveriesForSubmission\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "listActivityReviewEmailDeliveriesForSubmission not found");
  assert.match(fn!, /\.eq\("submission_id", submissionId\)/);
  assert.match(fn!, /order\("created_at", \{ ascending: false \}\)/);
});

test("the repository is the only place that writes to activity_review_email_deliveries -- it uses the admin client, never a client-facing Supabase import", () => {
  assert.match(SOURCE, /import \{ createSupabaseAdminClient \} from "@\/lib\/supabase\/server";/);
  assert.doesNotMatch(SOURCE, /createSupabaseRequestClient|createSupabaseBrowserClient/);
});
