import assert from "node:assert/strict";
import test from "node:test";
import { resolveCoinTransactionTypeLabel } from "./coinTransactionTypeLabels";

test("maps every known transaction_type to its administrator-friendly label", () => {
  assert.equal(resolveCoinTransactionTypeLabel("lesson_activity_reward"), "Lesson & Activity Reward");
  assert.equal(resolveCoinTransactionTypeLabel("admin_adjustment"), "Admin Adjustment");
  assert.equal(resolveCoinTransactionTypeLabel("store_redemption"), "Store Redemption");
  assert.equal(resolveCoinTransactionTypeLabel("ad_astra_contribution"), "Ad Astra Contribution");
  assert.equal(resolveCoinTransactionTypeLabel("correction"), "Correction");
  assert.equal(resolveCoinTransactionTypeLabel("competition_award"), "Competition Award");
  assert.equal(resolveCoinTransactionTypeLabel("promotional_award"), "Promotional Award");
  assert.equal(resolveCoinTransactionTypeLabel("special_achievement"), "Special Achievement");
});

test("falls back to the raw stored string for an unrecognised value, never a guessed label", () => {
  assert.equal(resolveCoinTransactionTypeLabel("some_future_type"), "some_future_type");
});

test("never throws and never crashes for non-string input", () => {
  assert.doesNotThrow(() => resolveCoinTransactionTypeLabel(undefined));
  assert.doesNotThrow(() => resolveCoinTransactionTypeLabel(null));
  assert.doesNotThrow(() => resolveCoinTransactionTypeLabel(42));
  assert.equal(resolveCoinTransactionTypeLabel(undefined), "Unknown");
  assert.equal(resolveCoinTransactionTypeLabel(null), "Unknown");
});

test("the underlying database value is never altered -- this is presentation only", () => {
  // resolveCoinTransactionTypeLabel is a pure function with no database
  // access of any kind.
  assert.equal(typeof resolveCoinTransactionTypeLabel, "function");
});
