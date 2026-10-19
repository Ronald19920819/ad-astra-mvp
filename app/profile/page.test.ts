import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// app/profile/page.tsx is a "use client" component with no "server-only"
// import, but it loads its data via a fetch() to an internal API route
// inside a hook (useAuthenticatedLearnerProfile), so it still can't be
// meaningfully rendered in a plain node:test run. These tests verify the
// real source directly, covering only the Stage A Store-entrance change.

const SOURCE = readFileSync("app/profile/page.tsx", "utf8");

test("the existing View XP & Coins action is preserved, not removed", () => {
  assert.match(SOURCE, /href="\/xp-coins"/);
  assert.match(SOURCE, /View XP &amp; Coins/);
});

test("a new Enter Store action was added to the same card, alongside it", () => {
  assert.match(SOURCE, /href="\/store"/);
  assert.match(SOURCE, /Enter Store/);
});

test("exactly one link to /xp-coins and one to /store exist -- the Store entrance was added, not duplicated", () => {
  assert.equal((SOURCE.match(/href="\/xp-coins"/g) ?? []).length, 1);
  assert.equal((SOURCE.match(/href="\/store"/g) ?? []).length, 1);
});

test("no other Profile section (Learner Information, My AD Astra Journey, Report Card, Settings) was modified by this change", () => {
  assert.match(SOURCE, /Learner Information/);
  assert.match(SOURCE, /My AD Astra Journey/);
  assert.match(SOURCE, /Learner Report Card/);
  assert.match(SOURCE, /Settings/);
});

test("no bottom-navigation change was introduced -- the existing five-item nav is untouched", () => {
  assert.match(SOURCE, /grid-cols-5/);
  assert.equal((SOURCE.match(/<Link href="\/(home|subjects|chat|schedule|profile)" prefetch=\{false\}>\s*\n\s*<div/g) ?? []).length, 5);
});

test("no Store redemption, purchase, or Coin deduction logic was introduced on this page", () => {
  assert.doesNotMatch(SOURCE, /store_redemption/);
  assert.doesNotMatch(SOURCE, /\.insert\(/);
  assert.doesNotMatch(SOURCE, /\.rpc\(/);
});
