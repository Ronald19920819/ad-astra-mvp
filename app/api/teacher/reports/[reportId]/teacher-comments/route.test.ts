import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.

const SOURCE = readFileSync(
  "app/api/teacher/reports/[reportId]/teacher-comments/route.ts",
  "utf8",
);

test("POST requires teacher authorization scoped to the report's own subject, resolved from the stored report row -- never a client-supplied subjectId", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn, "POST not found");
  assert.match(postFn!, /getMonthlyReportById\(reportId\)/);
  assert.match(postFn!, /authorizeTeacher\(existing\.subject_id\)/);
});

test("a finalised report is rejected before any validation or persistence is attempted", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn);
  const finalisedCheckIndex = postFn!.indexOf('existing.status === "finalised"');
  const validateIndex = postFn!.indexOf("validateTeacherEditedMonthlyReportComments(");
  const saveIndex = postFn!.indexOf("saveMonthlyReportTeacherEditedComments(");
  assert.ok(finalisedCheckIndex > -1 && validateIndex > -1 && saveIndex > -1);
  assert.ok(finalisedCheckIndex < validateIndex);
  assert.ok(validateIndex < saveIndex);
});

test("the request body is validated with the teacher-edit validator, never Kingdom's own gendered-language-checking parser", () => {
  assert.match(SOURCE, /validateTeacherEditedMonthlyReportComments\(body\)/);
  assert.doesNotMatch(SOURCE, /parseKingdomMonthlyReportComments/);
});

test("a validation failure returns 422 with the specific reason, never a generic 500", () => {
  const postFn = SOURCE.match(/export async function POST\([\s\S]*?\n\}/)?.[0];
  assert.ok(postFn);
  const catchIndex = postFn!.indexOf("catch (validationError)");
  const statusIndex = postFn!.indexOf("status: 422", catchIndex);
  const codeIndex = postFn!.indexOf('code: "INVALID_COMMENTS"', catchIndex);
  assert.ok(catchIndex > -1 && statusIndex > catchIndex && codeIndex > catchIndex);
});

test("saved comments are stamped with the teacher-edited schema and a fresh editedAt, and never touch kingdom_comments", () => {
  assert.match(SOURCE, /schemaVersion: MONTHLY_REPORT_TEACHER_EDITED_COMMENTS_SCHEMA_VERSION,/);
  assert.match(SOURCE, /editedAt: new Date\(\)\.toISOString\(\),/);
  assert.doesNotMatch(SOURCE, /kingdom_comments/);
});

test("this route never recomputes the report snapshot -- editing wording is independent of live report data", () => {
  assert.doesNotMatch(SOURCE, /recomputeMonthlyReportDraftSnapshot|generateMonthlyReportPreview/);
});

test("this route never calls Kingdom/OpenAI -- it only persists teacher-authored text", () => {
  assert.doesNotMatch(SOURCE, /openai|OpenAI|generateKingdomMonthlyReportComments/i);
});
