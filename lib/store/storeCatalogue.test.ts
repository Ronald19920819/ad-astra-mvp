import assert from "node:assert/strict";
import test from "node:test";
import { STORE_CATALOGUE } from "./storeCatalogue";

// storeCatalogue.ts is a pure static data module with no "server-only"
// import and no network call, so these are genuine behavioural tests
// against the real, unmirrored production data -- not source-string
// assertions.

test("exactly six catalogue items exist", () => {
  assert.equal(STORE_CATALOGUE.length, 6);
});

test("every catalogue item id is unique", () => {
  const ids = STORE_CATALOGUE.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("three KFC items at R20/R50/R100 with 2,000/5,000/10,000 Coin prices", () => {
  const kfc = STORE_CATALOGUE.filter((item) => item.provider === "KFC");
  assert.equal(kfc.length, 3);

  const byValue = new Map(kfc.map((item) => [item.randValue, item.coinCost]));
  assert.equal(byValue.get(20), 2000);
  assert.equal(byValue.get(50), 5000);
  assert.equal(byValue.get(100), 10000);
});

test("three Mr D SnackMe items at R20/R50/R100 with 2,000/5,000/10,000 Coin prices", () => {
  const snackMe = STORE_CATALOGUE.filter((item) => item.provider === "Mr D SnackMe");
  assert.equal(snackMe.length, 3);

  const byValue = new Map(snackMe.map((item) => [item.randValue, item.coinCost]));
  assert.equal(byValue.get(20), 2000);
  assert.equal(byValue.get(50), 5000);
  assert.equal(byValue.get(100), 10000);
});

test("Coin cost is always exactly 100x the Rand value, for every item", () => {
  for (const item of STORE_CATALOGUE) {
    assert.equal(item.coinCost, item.randValue * 100);
  }
});

test("no fabricated voucher code field exists on any item", () => {
  for (const item of STORE_CATALOGUE) {
    assert.ok(!("voucherCode" in item));
    assert.ok(!("code" in item));
  }
});

test("redemption method is one of the two genuine provider workflows", () => {
  for (const item of STORE_CATALOGUE) {
    assert.ok(item.redemptionMethod === "in_store_voucher" || item.redemptionMethod === "app_claim");
  }
});

test("no fulfilment note makes an unsupported promise (universal acceptance, free delivery, full meal coverage, or an official partnership)", () => {
  for (const item of STORE_CATALOGUE) {
    assert.doesNotMatch(item.fulfilmentNote, /free delivery/i);
    assert.doesNotMatch(item.fulfilmentNote, /full meal/i);
    assert.doesNotMatch(item.fulfilmentNote, /any branch|all branches|every branch/i);
    assert.doesNotMatch(item.fulfilmentNote, /official partner/i);
  }
});
