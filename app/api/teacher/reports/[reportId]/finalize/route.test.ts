import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([reportId]). Node's own `--test` CLI flag treats "[reportId]" as a
// glob character class even for a literal file argument, so it silently
// discovers ZERO tests here when run via the usual
// `find ... | xargs tsx --test` invocation (see the Stage 4A testing-
// methodology finding). Run this file explicitly instead:
//   node --import tsx "app/api/teacher/reports/[reportId]/finalize/route.test.ts"

const SOURCE = readFileSync(
  "app/api/teacher/reports/[reportId]/finalize/route.ts",
  "utf8",
);

test("POST requires teacher authorization scoped to the report's own subject, resolved from the stored report row -- never a client-supplied subjectId", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn, "POST not found");
  assert.match(postFn!, /getMonthlyReportById\(reportId\)/);
  assert.match(postFn!, /authorizeTeacher\(existing\.subject_id\)/);
});

test("authorization happens before finalizeMonthlyReport is ever called", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn);
  const authIndex = postFn!.indexOf("authorizeTeacher(existing.subject_id)");
  const finalizeIndex = postFn!.indexOf("finalizeMonthlyReport(reportId)");
  assert.ok(authIndex > -1 && finalizeIndex > -1);
  assert.ok(authIndex < finalizeIndex);
});

test("the client sends no request body at all -- finalisation trusts nothing from the browser beyond the report ID in the URL", () => {
  assert.doesNotMatch(SOURCE, /await request\.json\(\)/);
});

test("every finalizeMonthlyReport failure code is mapped to a specific HTTP status, never a single generic one", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn);
  assert.match(
    postFn!,
    /result\.code === "ALREADY_FINALISED" \|\|\s*\n\s*result\.code === "CONCURRENT_FINALISATION" \|\|\s*\n\s*result\.code === "ALREADY_FINALISED_PERIOD"\s*\n\s*\? 409/,
  );
  assert.match(postFn!, /result\.code === "INVALID_SNAPSHOT"\s*\n\s*\? 500/);
  assert.match(postFn!, /: 422; \/\/ NO_KINGDOM_COMMENTS, STALE_COMMENTARY, INVALID_COMMENTS/);
});

// AD ASTRA MONTHLY REPORT -- STAGE 4E: RACE-CONDITION PROTECTION. Even if
// two finalisation attempts somehow race past the Stage 4D application
// guard, the database's own partial unique index is the final authority --
// this route must map that specific failure (ALREADY_FINALISED_PERIOD)
// to a clear, controlled 409, exactly like the other "someone got there
// first" outcomes, never a raw/opaque error.
test("a race that reaches the database's own uniqueness constraint (ALREADY_FINALISED_PERIOD) is treated exactly like the other 'someone got there first' outcomes -- a controlled 409, not a 500", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn);
  assert.match(postFn!, /result\.code === "ALREADY_FINALISED_PERIOD"/);
});

test("a successful finalisation returns the finalised report row under the same 'report' key the preview/draft routes already use", () => {
  assert.match(SOURCE, /NextResponse\.json\(\{ report: result\.report \}\);/);
});

test("this route never recomputes or reads report_snapshot itself -- all of that authority lives inside finalizeMonthlyReport", () => {
  assert.doesNotMatch(SOURCE, /generateMonthlyReportPreview|report_snapshot/);
});
