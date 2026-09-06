import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This page transitively imports "server-only" (via authorizeAdministrator
// and getAdminLearnerCoinHistory), so per this codebase's established
// precedent it cannot be invoked directly in a plain node:test run.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([learnerId]). Run this file explicitly, never via the standard glob
// runner:
//   node --import tsx "app/teacher/admin/coins/[learnerId]/page.test.ts"

const SOURCE = readFileSync("app/teacher/admin/coins/[learnerId]/page.tsx", "utf8");

// The page component's own multi-line destructured prop type would
// falsely terminate a naive [\s\S]*?\n\} regex at that type's own
// closing brace -- see the established fix for this in this codebase's
// other page tests -- so this slices to end-of-file (the component is
// the last declaration before its own helper function).
const pageComponent = SOURCE.slice(
  SOURCE.indexOf("export default async function TeacherAdminLearnerCoinHistoryPage("),
  SOURCE.indexOf("function SummaryStat("),
);

test("a malformed learnerId (not a UUID) is rejected before any authorization or database work", () => {
  const uuidCheckIndex = pageComponent.indexOf("uuidPattern.test(learnerId)");
  const authIndex = pageComponent.indexOf("await authorizeAdministrator()");
  assert.ok(uuidCheckIndex > -1 && authIndex > -1 && uuidCheckIndex < authIndex);
});

test("authorization happens BEFORE the learnerId is ever used to load data -- a guessed UUID cannot bypass this", () => {
  const authIndex = pageComponent.indexOf("await authorizeAdministrator()");
  const historyIndex = pageComponent.indexOf("await getAdminLearnerCoinHistory(learnerId)");
  assert.ok(authIndex > -1 && historyIndex > -1 && authIndex < historyIndex);
});

test("an unauthorised caller and a non-existent learner both get the exact same notFound() -- no information leak about which is which", () => {
  assert.match(pageComponent, /if \(!authorization\.success\) \{\s*\n\s*notFound\(\);/);
  assert.match(pageComponent, /if \(!history\) \{\s*\n\s*notFound\(\);/);
});

test("readable transaction type labels are resolved via the canonical mapping, never re-implemented inline", () => {
  assert.match(
    SOURCE,
    /import \{ resolveCoinTransactionTypeLabel \} from "@\/lib\/coins\/coinTransactionTypeLabels";/,
  );
  assert.match(SOURCE, /resolveCoinTransactionTypeLabel\(transaction\.transactionType\)/);
});

test("subject/lesson/activity attribution is shown where available, gracefully omitted when not", () => {
  assert.match(
    SOURCE,
    /\[transaction\.subjectName, transaction\.lessonLabel, transaction\.activityTitle\]\s*\n\s*\.filter\(Boolean\)/,
  );
});

test("no raw metadata or internal identifiers are rendered -- only the fields the reader already scoped for display", () => {
  assert.doesNotMatch(SOURCE, /transaction\.metadata|transaction\.id\}<|referenceTransactionId/);
});

test("this page contains no Coin write/adjustment action of any kind -- Stage 1 is read-only", () => {
  assert.doesNotMatch(SOURCE, /\.insert\(|\.update\(|\.delete\(|Add Coins|Subtract Coins/i);
});
