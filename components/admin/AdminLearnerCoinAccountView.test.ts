import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// "use client" component -- verified via source inspection, matching
// this codebase's established convention for such components.

const SOURCE = readFileSync("components/admin/AdminLearnerCoinAccountView.tsx", "utf8");

test("after a successful adjustment, refreshes via router.refresh() -- the same server fetch the page already performs -- never a separate client-side re-fetch path or an optimistic local balance edit", () => {
  assert.match(SOURCE, /import \{ useRouter \} from "next\/navigation";/);
  const handleFn = SOURCE.match(/function handleAdjusted\([\s\S]*?\n  \}/)?.[0];
  assert.ok(handleFn, "handleAdjusted not found");
  assert.match(handleFn!, /router\.refresh\(\);/);
  assert.doesNotMatch(SOURCE, /fetch\(`\/api\/teacher\/admin\/coins/);
});

test("shows a clear success message after a successful adjustment, and hides the form again", () => {
  const handleFn = SOURCE.match(/function handleAdjusted\([\s\S]*?\n  \}/)?.[0];
  assert.ok(handleFn);
  assert.match(handleFn!, /setSuccessMessage\(message\);/);
  assert.match(handleFn!, /setIsAdjusting\(false\);/);
});

test("resolves readable transaction type labels via the canonical mapping, never re-implemented inline", () => {
  assert.match(
    SOURCE,
    /import \{ resolveCoinTransactionTypeLabel \} from "@\/lib\/coins\/coinTransactionTypeLabels";/,
  );
  assert.match(SOURCE, /resolveCoinTransactionTypeLabel\(transaction\.transactionType\)/);
});

test("an admin-authored transaction's source shows the generic 'Added by Administrator' label, distinct from automatic system rewards", () => {
  assert.match(SOURCE, /transaction\.actorType === "system"\s*\n\s*\? "Automatic"\s*\n\s*: transaction\.actorType === "admin"\s*\n\s*\? "Added by Administrator"/);
});

test("no raw metadata or internal identifiers are rendered in the transaction list -- only the fields the reader already scoped for display", () => {
  assert.doesNotMatch(SOURCE, /transaction\.metadata|referenceTransactionId/);
});

test("the Adjust Coins panel is delegated to its own dedicated form component -- no inline duplicate form implementation here", () => {
  assert.match(
    SOURCE,
    /import \{ AdjustCoinsForm \} from "@\/components\/admin\/AdjustCoinsForm";/,
  );
  assert.match(SOURCE, /<AdjustCoinsForm/);
});

test("the Adjust Coins button is only ever rendered when the form isn't already open -- never both simultaneously", () => {
  assert.match(SOURCE, /\{isAdjusting \? \(/);
});
