import assert from "node:assert/strict";
import test from "node:test";
import { isMissingStoreRedemptionsTableError } from "./storeRedemptionErrors";

// This module deliberately has no "server-only" import and does no I/O
// -- it is imported and tested directly with real inputs (not source
// inspection), including a regression test for the exact PGRST205 error
// ("Could not find public.store_redemptions in the schema cache")
// observed while Stage B's migrations had not yet been applied.

test("recognises the exact real-world missing-table error (PGRST205 for store_redemptions)", () => {
  assert.equal(
    isMissingStoreRedemptionsTableError({
      code: "PGRST205",
      message: "Could not find the table 'public.store_redemptions' in the schema cache",
    }),
    true,
  );
});

test("an unrelated error code is never treated as the missing-table case -- it must stay observable to the caller", () => {
  assert.equal(
    isMissingStoreRedemptionsTableError({ code: "42501", message: "permission denied" }),
    false,
  );
});

test("PGRST205 for a DIFFERENT table is never mistaken for this one", () => {
  assert.equal(
    isMissingStoreRedemptionsTableError({
      code: "PGRST205",
      message: "Could not find the table 'public.some_other_table' in the schema cache",
    }),
    false,
  );
});

test("null, undefined, a plain string, and a bare Error all return false without throwing", () => {
  assert.equal(isMissingStoreRedemptionsTableError(null), false);
  assert.equal(isMissingStoreRedemptionsTableError(undefined), false);
  assert.equal(isMissingStoreRedemptionsTableError("some string error"), false);
  assert.equal(isMissingStoreRedemptionsTableError(new Error("boom")), false);
});

test("a PGRST205 with no message field is rejected rather than matching on code alone", () => {
  assert.equal(isMissingStoreRedemptionsTableError({ code: "PGRST205" }), false);
});
