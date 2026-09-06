import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" -- cannot be invoked directly in a
// plain node:test run, per this codebase's established precedent.

const SOURCE = readFileSync("lib/supabase/adminCoinReader.ts", "utf8");

test("every balance/total is computed by folding real coin_transactions rows -- never read from a cached balance column", () => {
  assert.doesNotMatch(SOURCE, /coin_balance|cached_balance|\.balance\s*:\s*learner\./);
  assert.match(SOURCE, /\.from\("coin_transactions"\)/);
});

test("getAdminCoinOverview never writes to coin_transactions -- read-only, Stage 1 scope", () => {
  const fn = SOURCE.match(/export async function getAdminCoinOverview\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "getAdminCoinOverview not found");
  assert.doesNotMatch(fn!, /\.insert\(|\.update\(|\.delete\(/);
});

test("getAdminCoinOverview reads the entire ledger in exactly one query, never one query per learner", () => {
  const fn = SOURCE.match(/export async function getAdminCoinOverview\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  const ledgerReads = fn!.match(/\.from\("coin_transactions"\)/g) ?? [];
  assert.equal(ledgerReads.length, 1);
});

test("current balance, total earned, and total spent are each derived from the same signed amount, never three separate queries", () => {
  const foldFn = SOURCE.match(/function foldTransaction\([\s\S]*?\n\}/)?.[0];
  assert.ok(foldFn, "foldTransaction not found");
  assert.match(foldFn!, /balance: aggregate\.balance \+ amount/);
  assert.match(foldFn!, /earned: aggregate\.earned \+ \(amount > 0 \? amount : 0\)/);
  assert.match(foldFn!, /spent: aggregate\.spent \+ \(amount < 0 \? -amount : 0\)/);
});

test("total spent is reported as a positive (absolute) figure, never a raw negative sum", () => {
  assert.match(SOURCE, /-amount : 0\)/);
  assert.doesNotMatch(SOURCE, /totalSpent: totalCoinsSpent \* -1|Math\.abs\(totalCoinsSpent\) \* -1/);
});

test("learners with a genuine zero balance are included, not filtered out -- 'learners with Coins' is a separate count of balance > 0", () => {
  assert.match(SOURCE, /learnersWithCoins: learners\.filter\(\(learner\) => learner\.currentBalance > 0\)\.length,/);
  assert.doesNotMatch(SOURCE, /learners\.filter\(\(learner\) => learner\.currentBalance > 0\)\.map/);
});

test("PART H: active learners and ledger-only (e.g. inactive) learners are unioned via batched .in() lookups, never a per-learner query", () => {
  assert.match(SOURCE, /\.eq\("status", "active"\)/);
  assert.match(SOURCE, /const ledgerOnlyIds = \[\.\.\.aggregateByLearnerId\.keys\(\)\]\.filter/);
  const inCalls = SOURCE.match(/\.in\(/g) ?? [];
  assert.ok(inCalls.length >= 2, "expected at least two batched .in() lookups (active profiles + ledger-only profiles)");
});

test("default sort is deterministic -- current balance highest to lowest, then learner name alphabetically -- never left to query order", () => {
  const sortBlock = SOURCE.match(/learners\.sort\(\(a, b\) => \{[\s\S]*?\n  \}\);/)?.[0];
  assert.ok(sortBlock, "learners.sort(...) not found");
  assert.match(sortBlock!, /b\.currentBalance - a\.currentBalance/);
  assert.match(sortBlock!, /a\.learnerName\.localeCompare\(b\.learnerName\)/);
});

test("getAdminLearnerCoinHistory resolves subject names from the static subject configuration, never an extra per-transaction database round-trip", () => {
  assert.match(
    SOURCE,
    /import \{ getSubjectConfigurationByDatabaseId \} from "@\/lib\/subjects\/subjectConfig";/,
  );
  assert.doesNotMatch(SOURCE, /\.from\("subjects"\)/);
});

test("getAdminLearnerCoinHistory resolves lesson/activity/actor names via batched .in() queries scoped to this one learner's distinct ids, run in parallel", () => {
  const fn = SOURCE.match(/export async function getAdminLearnerCoinHistory\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(fn, "getAdminLearnerCoinHistory not found");
  assert.match(fn!, /Promise\.all\(\[/);
  assert.match(fn!, /\.from\("lessons"\)\.select\("id, lesson_number, title"\)\.in\("id", lessonIds\)/);
  assert.match(fn!, /\.from\("activities"\)\.select\("id, title"\)\.in\("id", activityIds\)/);
});

test("getAdminLearnerCoinHistory never writes to coin_transactions -- read-only, Stage 1 scope", () => {
  const fn = SOURCE.match(/export async function getAdminLearnerCoinHistory\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(fn);
  assert.doesNotMatch(fn!, /\.insert\(|\.update\(|\.delete\(/);
});

test("getAdminLearnerCoinHistory scopes the transaction query to exactly one learner_id, ordered newest first", () => {
  const fn = SOURCE.match(/export async function getAdminLearnerCoinHistory\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(fn);
  assert.match(fn!, /\.eq\("learner_id", learnerId\)/);
  assert.match(fn!, /order\("created_at", \{ ascending: false \}\)/);
});

test("the transaction entry shape never exposes raw metadata jsonb or reference_transaction_id -- only the explicit fields Part I lists", () => {
  const typeDecl = SOURCE.match(/export type AdminCoinTransactionEntry = \{[\s\S]*?\};/)?.[0];
  assert.ok(typeDecl, "AdminCoinTransactionEntry type not found");
  assert.doesNotMatch(typeDecl!, /metadata|reference_transaction_id/);
});

test("returns null for a learner id with no resolvable profile, rather than throwing or exposing partial data", () => {
  const fn = SOURCE.match(/export async function getAdminLearnerCoinHistory\([\s\S]*?\n\}$/m)?.[0];
  assert.ok(fn);
  assert.match(fn!, /if \(!profile\) return null;/);
});

test("the repository is server-only and uses the admin client exclusively -- never a client-facing Supabase import", () => {
  assert.match(SOURCE, /^import "server-only";/);
  assert.match(SOURCE, /import \{ createSupabaseAdminClient \} from "@\/lib\/supabase\/server";/);
  assert.doesNotMatch(SOURCE, /createSupabaseRequestClient|createSupabaseBrowserClient/);
});
