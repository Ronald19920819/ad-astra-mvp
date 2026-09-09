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
//
// AD ASTRA ADMINISTRATOR COIN MANAGEMENT -- STAGE 2: this Server Component
// now owns ONLY authorisation and the initial data fetch -- all
// transaction-history rendering and the Adjust Coins interactivity moved
// to the client AdminLearnerCoinAccountView (see that component's own
// test file for those assertions).

const SOURCE = readFileSync("app/teacher/admin/coins/[learnerId]/page.tsx", "utf8");

// The page component's own multi-line destructured prop type would
// falsely terminate a naive [\s\S]*?\n\} regex at that type's own
// closing brace -- see the established fix for this in this codebase's
// other page tests -- so this slices to end-of-file (the component is
// the last declaration in the file).
const pageComponent = SOURCE.slice(
  SOURCE.indexOf("export default async function TeacherAdminLearnerCoinHistoryPage("),
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

test("delegates all interactivity (Adjust Coins, transaction history, refresh) to the client AdminLearnerCoinAccountView -- this Server Component renders no table/form/button itself", () => {
  assert.match(
    SOURCE,
    /import \{ AdminLearnerCoinAccountView \} from "@\/components\/admin\/AdminLearnerCoinAccountView";/,
  );
  assert.match(
    pageComponent,
    /<AdminLearnerCoinAccountView learnerId=\{learnerId\} history=\{history\} \/>/,
  );
  assert.doesNotMatch(SOURCE, /<table|resolveCoinTransactionTypeLabel/);
  assert.doesNotMatch(pageComponent, /Adjust Coins/);
});

test("this page performs no Coin write of any kind -- it only authorises and reads", () => {
  assert.doesNotMatch(SOURCE, /\.insert\(|\.update\(|\.delete\(/);
});
