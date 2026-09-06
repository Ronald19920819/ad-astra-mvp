import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" (via authorizeAdministrator and
// getAdminCoinOverview) -- verified via source inspection.

const SOURCE = readFileSync("app/teacher/admin/coins/page.tsx", "utf8");

test("authorises via the canonical authorizeAdministrator() helper before loading any Coin data", () => {
  assert.match(
    SOURCE,
    /import \{ authorizeAdministrator \} from "@\/lib\/supabase\/teacherAuth";/,
  );
  const authIndex = SOURCE.indexOf("await authorizeAdministrator()");
  const overviewIndex = SOURCE.indexOf("await getAdminCoinOverview()");
  assert.ok(authIndex > -1 && overviewIndex > -1 && authIndex < overviewIndex);
});

test("an unauthorised caller gets notFound(), matching the existing security convention", () => {
  assert.match(SOURCE, /if \(!authorization\.success\) \{\s*\n\s*notFound\(\);/);
});

test("all four required summary figures are displayed: Coins in circulation, learners with Coins, total earned, total spent", () => {
  assert.match(SOURCE, /label="Total Coins in Circulation"/);
  assert.match(SOURCE, /label="Learners with Coins"/);
  assert.match(SOURCE, /label="Total Coins Earned"/);
  assert.match(SOURCE, /label="Total Coins Spent"/);
});

test("every summary figure is read from the overview computed by the admin Coin reader -- never a separate calculation on this page", () => {
  assert.match(SOURCE, /overview\.totalCoinsInCirculation/);
  assert.match(SOURCE, /overview\.learnersWithCoins/);
  assert.match(SOURCE, /overview\.totalCoinsEarned/);
  assert.match(SOURCE, /overview\.totalCoinsSpent/);
});

test("Coin figures are formatted with a thousands separator and the AC suffix", () => {
  const fn = SOURCE.match(/function formatCoins\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "formatCoins not found");
  assert.match(fn!, /toLocaleString\("en-ZA"\)/);
  assert.match(fn!, /\$\{amount\.toLocaleString\("en-ZA"\)\} AC/);
});

test("the learner table is delegated to its own dedicated component -- no inline duplicate table/search implementation on this page", () => {
  assert.match(
    SOURCE,
    /import \{ AdminCoinLearnerTable \} from "@\/components\/admin\/AdminCoinLearnerTable";/,
  );
  assert.match(SOURCE, /<AdminCoinLearnerTable learners=\{overview\.learners\} \/>/);
  assert.doesNotMatch(SOURCE, /<table/);
});

test("this page contains no Coin write/adjustment action of any kind -- Stage 1 is read-only", () => {
  assert.doesNotMatch(SOURCE, /\.insert\(|\.update\(|\.delete\(|Add Coins|Subtract Coins/i);
});
