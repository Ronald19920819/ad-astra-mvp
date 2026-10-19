import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// app/xp-coins/page.tsx transitively imports "server-only" (via
// getCurrentLearnerContext / getLearnerRewardsSummary), so per this
// codebase's established precedent it cannot be invoked directly in a
// plain node:test run. These tests verify the real source directly,
// covering only the Stage A Store-navigation change (both previously
// disabled "Coming Soon" Store placeholders becoming real links).

const SOURCE = readFileSync("app/xp-coins/page.tsx", "utf8");

test("both Store entrances are real, working links to /store, not disabled placeholders", () => {
  assert.match(
    SOURCE,
    /<Link\s*\n\s*href="\/store"\s*\n\s*prefetch=\{false\}/,
  );
  const storeLinkCount = (SOURCE.match(/href="\/store"/g) ?? []).length;
  assert.equal(storeLinkCount, 2, "expected exactly two links to /store (the Coins card button and the full-width entrance)");
});

test("no disabled/cursor-not-allowed Store control remains", () => {
  assert.doesNotMatch(SOURCE, /cursor-not-allowed[\s\S]*View Store/);
  assert.doesNotMatch(SOURCE, /The Ad Astra Store is coming soon\./);
});

test("the literal 'Coming Soon' Store copy has been removed", () => {
  assert.doesNotMatch(SOURCE, /Coming Soon/);
});

test("the full-width Store section now links out via an Enter Store call to action", () => {
  assert.match(SOURCE, /Enter Store/);
});

test("the Coins card's View Store link sits alongside the unmodified Coin History link, not in place of it", () => {
  assert.match(SOURCE, /View Store/);
  assert.match(SOURCE, /Coin History/);
});

test("no Store redemption, purchase, or Coin deduction logic was introduced on this page", () => {
  assert.doesNotMatch(SOURCE, /store_redemption/);
  assert.doesNotMatch(SOURCE, /\.insert\(/);
  assert.doesNotMatch(SOURCE, /\.rpc\(/);
});

test("no bottom-navigation change was introduced -- the existing five-item nav is untouched", () => {
  assert.match(SOURCE, /grid-cols-5/);
  const navItemCount = (SOURCE.match(/<Link href="\/(home|subjects|chat|schedule|profile)" prefetch=\{false\}>/g) ?? []).length;
  assert.equal(navItemCount, 5);
});
