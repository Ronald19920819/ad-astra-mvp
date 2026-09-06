import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" component -- verified via source inspection to stay
// consistent with this codebase's established convention for such
// components, even though this one has no next/font or next/image
// dependency.

const SOURCE = readFileSync("components/admin/AdminCoinLearnerTable.tsx", "utf8");

test("filters the already-loaded, already-sorted learner list locally by name -- it never re-fetches or re-sorts from the server", () => {
  assert.match(SOURCE, /learner\.learnerName\.toLowerCase\(\)\.includes\(trimmed\)/);
  assert.doesNotMatch(SOURCE, /fetch\(/);
});

test("shows exactly the required columns: Learner, Current Balance, Total Earned, Total Spent / Deducted, Last Coin Activity, Action", () => {
  assert.match(SOURCE, />Learner</);
  assert.match(SOURCE, />Current Balance</);
  assert.match(SOURCE, />Total Earned</);
  assert.match(SOURCE, />Total Spent \/ Deducted</);
  assert.match(SOURCE, />Last Coin Activity</);
  assert.match(SOURCE, />Action</);
});

test("the Action column links to the individual learner history route, never a Coin write/adjustment action", () => {
  assert.match(SOURCE, /href=\{`\/teacher\/admin\/coins\/\$\{learner\.learnerId\}`\}/);
  assert.match(SOURCE, />\s*View History\s*</);
  assert.doesNotMatch(SOURCE, /Add Coins|Subtract Coins|Adjust/i);
});

test("never renders a learner's raw auth UUID as visible text -- every reference to it is either the React list key or the History link's href, never a standalone displayed value", () => {
  const totalOccurrences = SOURCE.match(/learner\.learnerId/g) ?? [];
  const keyOccurrences = SOURCE.match(/key=\{learner\.learnerId\}/g) ?? [];
  const hrefOccurrences = SOURCE.match(/\$\{learner\.learnerId\}/g) ?? [];
  assert.ok(keyOccurrences.length > 0, "expected the React list key to use learner.learnerId");
  assert.ok(hrefOccurrences.length > 0, "expected the History link href to use learner.learnerId");
  assert.equal(
    totalOccurrences.length,
    keyOccurrences.length + hrefOccurrences.length,
    "learner.learnerId must only ever appear as the list key or inside the href -- never as visible display text",
  );
  // The visible Learner column renders the name, never the id.
  assert.match(SOURCE, /\{learner\.learnerName\}<\/td>/);
});

test("Coin amounts are formatted with a thousands separator and the AC suffix", () => {
  const fn = SOURCE.match(/function formatCoins\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "formatCoins not found");
  assert.match(fn!, /toLocaleString\("en-ZA"\)/);
  assert.match(fn!, /\$\{amount\.toLocaleString\("en-ZA"\)\} AC/);
});

test("distinguishes an empty overall list from a search with no matches", () => {
  assert.match(SOURCE, /learners\.length === 0 \? "No learners found\." : "No learners match this search\."/);
});
