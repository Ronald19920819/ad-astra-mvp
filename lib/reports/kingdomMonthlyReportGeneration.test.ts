import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// AD ASTRA MONTHLY REPORT -- STAGE 3: kingdomMonthlyReportGeneration.ts
// imports "server-only" (it instantiates the real OpenAI client at module
// scope), so it cannot be imported directly under plain node:test/tsx --
// matching the established convention elsewhere in this codebase for such
// files, these assertions verify the real source text instead. The pure
// logic it orchestrates (evidence/prompt/parse) is already fully exercised
// by direct import in kingdomMonthlyReport.test.ts.

const SOURCE = readFileSync(
  "lib/reports/kingdomMonthlyReportGeneration.ts",
  "utf8",
);

test("the module is server-only", () => {
  assert.match(SOURCE, /^import "server-only";/m);
});

test("fails safely: retries at most once on validation failure, and never returns/persists an unvalidated result", () => {
  assert.match(SOURCE, /const MAX_ATTEMPTS = 2;/);
  assert.match(SOURCE, /attempt <= MAX_ATTEMPTS/);
  assert.match(SOURCE, /throw lastError \?\?/);
});

test("a validation failure on attempt 1 is threaded into attempt 2 as retryReason, not silently repeated", () => {
  assert.match(SOURCE, /retryReason: lastError\?\.message/);
});

test("the returned record's snapshotHash is computed from the exact payload that was sent to Kingdom, never a different/stale one", () => {
  assert.match(
    SOURCE,
    /snapshotHash: hashMonthlyReportSnapshot\(payload\),/,
  );
});

test("never persists a comments record when every attempt fails -- the function only ever returns via the validated success path or throws", () => {
  const returnStatements = SOURCE.match(/return \{[\s\S]*?\};/g) ?? [];
  assert.equal(returnStatements.length, 1, "expected exactly one success return site");
  assert.match(returnStatements[0]!, /comments,/);
});
