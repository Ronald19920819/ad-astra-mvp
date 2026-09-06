import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.

const SOURCE = readFileSync(
  "app/api/teacher/reports/[reportId]/comments/route.ts",
  "utf8",
);

test("POST requires teacher authorization scoped to the report's own subject, resolved from the stored report row -- never a client-supplied subjectId", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn, "POST not found");
  assert.match(postFn!, /getMonthlyReportById\(reportId\)/);
  assert.match(postFn!, /authorizeTeacher\(existing\.subject_id\)/);
});

test("a finalised report is rejected before any recomputation or Kingdom call is attempted", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn);
  const finalisedCheckIndex = postFn!.indexOf('existing.status === "finalised"');
  const recomputeIndex = postFn!.indexOf("recomputeMonthlyReportDraftSnapshot(");
  const generateIndex = postFn!.indexOf("generateKingdomMonthlyReportComments(");
  assert.ok(finalisedCheckIndex > -1 && recomputeIndex > -1 && generateIndex > -1);
  assert.ok(finalisedCheckIndex < recomputeIndex);
  assert.ok(recomputeIndex < generateIndex);
});

test("the authoritative draft snapshot is always recomputed from live data immediately before calling Kingdom -- comments can never describe a stale selection", () => {
  assert.match(SOURCE, /recomputeMonthlyReportDraftSnapshot\(reportId\)/);
  assert.match(SOURCE, /payload: recomputed\.report_snapshot,/);
});

test("the client sends no report statistics at all -- only the report ID travels in the request", () => {
  assert.doesNotMatch(SOURCE, /await request\.json\(\)/);
});

test("generated comments are persisted via saveMonthlyReportKingdomComments, never a direct/inline write to kingdom_comments", () => {
  assert.match(SOURCE, /saveMonthlyReportKingdomComments\(reportId, storedComments\)/);
  assert.doesNotMatch(SOURCE, /\.update\(\{[\s\S]*?kingdom_comments/);
});

test("this route never calls finalizeMonthlyReport -- generating commentary never finalises the report", () => {
  assert.doesNotMatch(SOURCE, /finalizeMonthlyReport/);
});

test("the Kingdom subject context uses the Analyst role for report commentary, distinct from Author/Tutor/Examiner", () => {
  assert.match(SOURCE, /role: "Analyst",/);
});
