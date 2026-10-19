import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via
// getCurrentLearnerContext / getLearnerStoreRedemptions), so per this
// codebase's established precedent it cannot be invoked directly in a
// plain node:test run. These tests verify the real source directly.

const SOURCE = readFileSync("app/api/store/history/route.ts", "utf8");

test("the learner is resolved via the canonical getCurrentLearnerContext(), never a client-supplied id", () => {
  assert.match(
    SOURCE,
    /import \{ getCurrentLearnerContext \} from "@\/lib\/supabase\/currentLearnerContext";/,
  );
  assert.match(SOURCE, /const context = await getCurrentLearnerContext\(\);/);
});

test("an unsuccessful context returns 401 with the context's own message, never private data", () => {
  assert.match(
    SOURCE,
    /if \(context\.status !== "success"\) \{\s*\n\s*return NextResponse\.json\(\{ error: context\.message, code: context\.code \}, \{ status: 401 \}\);/,
  );
});

test("redemptions are read scoped to this exact resolved learner via getLearnerStoreRedemptions(), never a hand-written query", () => {
  assert.match(
    SOURCE,
    /import \{ getLearnerStoreRedemptions \} from "@\/lib\/supabase\/storeRedemptions";/,
  );
  assert.match(
    SOURCE,
    /await getLearnerStoreRedemptions\(context\.identity\.learnerId\);/,
  );
  assert.doesNotMatch(SOURCE, /\.from\("store_redemptions"\)/);
});

test("no write/RPC call exists on this read-only route", () => {
  assert.doesNotMatch(SOURCE, /\.insert\(/);
  assert.doesNotMatch(SOURCE, /\.update\(/);
  assert.doesNotMatch(SOURCE, /\.rpc\(/);
});

test("type safety: no any, @ts-ignore or @ts-expect-error is used anywhere in this file", () => {
  assert.doesNotMatch(SOURCE, /:\s*any\b/);
  assert.doesNotMatch(SOURCE, /@ts-ignore/);
  assert.doesNotMatch(SOURCE, /@ts-expect-error/);
});
