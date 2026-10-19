import assert from "node:assert/strict";
import test from "node:test";
import { canAffordItem, formatAcBalanceDisplay, hasValidAcBalance } from "./storeBalanceDisplay";

// Pure module, no "server-only" import and no network call -- these are
// genuine behavioural tests against the real, unmirrored production
// code. Added as a direct regression suite for the Stage B runtime
// crash: "Cannot read properties of undefined (reading 'toLocaleString')"
// in components/store/StoreItemCard.tsx, caused by a `!== null`-only
// guard that does not catch an actually-undefined value.

test("hasValidAcBalance: undefined is NOT a valid balance (the exact crash input)", () => {
  assert.equal(hasValidAcBalance(undefined), false);
});

test("hasValidAcBalance: null is NOT a valid balance", () => {
  assert.equal(hasValidAcBalance(null), false);
});

test("hasValidAcBalance: 0 IS a valid balance -- a learner with zero Coins is not 'unavailable'", () => {
  assert.equal(hasValidAcBalance(0), true);
});

test("hasValidAcBalance: a positive number is a valid balance", () => {
  assert.equal(hasValidAcBalance(5000), true);
});

test("hasValidAcBalance: NaN is rejected even though typeof NaN === 'number'", () => {
  assert.equal(hasValidAcBalance(Number.NaN), false);
});

test("formatAcBalanceDisplay: undefined formats as 'unavailable', never throws, never a fabricated 0", () => {
  assert.equal(formatAcBalanceDisplay(undefined), "unavailable");
});

test("formatAcBalanceDisplay: null formats as 'unavailable'", () => {
  assert.equal(formatAcBalanceDisplay(null), "unavailable");
});

test("formatAcBalanceDisplay: 0 formats as the real '0 AC', not 'unavailable' and not skipped", () => {
  assert.equal(formatAcBalanceDisplay(0), "0 AC");
});

test("formatAcBalanceDisplay: a positive number formats with thousands separators", () => {
  assert.equal(formatAcBalanceDisplay(12000), "12,000 AC");
});

test("canAffordItem: undefined balance is never reported as affordable OR unaffordable with confidence -- it is false (unknown), never crashing", () => {
  assert.equal(canAffordItem(undefined, 2000), false);
});

test("canAffordItem: null balance -> false, never a comparison against null", () => {
  assert.equal(canAffordItem(null, 2000), false);
});

test("canAffordItem: 0 balance against a positive cost -> false (genuinely cannot afford it, not 'unavailable')", () => {
  assert.equal(canAffordItem(0, 2000), false);
});

test("canAffordItem: a balance exactly equal to the cost is affordable", () => {
  assert.equal(canAffordItem(2000, 2000), true);
});

test("canAffordItem: a balance greater than the cost is affordable", () => {
  assert.equal(canAffordItem(5000, 2000), true);
});

test("canAffordItem: a balance less than the cost is not affordable", () => {
  assert.equal(canAffordItem(1000, 2000), false);
});
