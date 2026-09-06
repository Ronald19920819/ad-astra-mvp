import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This page transitively imports "server-only" (via
// monthlyReportRepository.ts) and JSX, so per this codebase's established
// precedent it cannot be invoked directly in a plain node:test run.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([reportId]). Run this file explicitly, never via the standard glob
// runner:
//   node --import tsx "app/teacher/reports/[reportId]/page.test.ts"

const SOURCE = readFileSync("app/teacher/reports/[reportId]/page.tsx", "utf8");

// The page component is the last declaration in the file, and its own
// multi-line destructured prop type (`{ params }: { params: ... }`) would
// falsely terminate a naive `[\s\S]*?\n\}` regex at that type's own
// closing brace (a "}" immediately following a newline) rather than the
// function's real end -- so this slices to end-of-file instead of relying
// on brace-matching.
const pageFn = SOURCE.slice(
  SOURCE.indexOf("export default async function TeacherHistoricalReportPage("),
);

test("loads the report via the FINALISED-ONLY reader -- never getMonthlyReportById, never the live report engine", () => {
  assert.match(SOURCE, /findFinalisedMonthlyReportById\(reportId\)/);
  assert.doesNotMatch(SOURCE, /getMonthlyReportById|generateMonthlyReportPreview/);
});

test("a report that doesn't exist (or isn't finalised, since the reader only ever returns finalised rows) renders notFound()", () => {
  assert.match(pageFn, /if \(!report\) \{\s*\n\s*notFound\(\);/);
});

test("authorises the teacher against the report's OWN stored subject_id -- never a client-supplied value, and only after the report has been loaded", () => {
  assert.match(pageFn, /authorizeTeacher\(report\.subject_id\)/);
  const loadIndex = pageFn.indexOf("findFinalisedMonthlyReportById(reportId)");
  const authIndex = pageFn.indexOf("authorizeTeacher(report.subject_id)");
  assert.ok(loadIndex > -1 && authIndex > -1 && loadIndex < authIndex);
});

test("an unauthorised (or unauthenticated) teacher gets the exact same notFound() outcome as a missing report -- no information leak about whether the report exists", () => {
  assert.match(pageFn, /if \(!authorization\.success\) \{\s*\n\s*notFound\(\);/);
});

test("a malformed reportId (not a UUID) is rejected before any database query is attempted", () => {
  const uuidCheckIndex = pageFn.indexOf("uuidPattern.test(reportId)");
  const loadIndex = pageFn.indexOf("findFinalisedMonthlyReportById(reportId)");
  assert.ok(uuidCheckIndex > -1 && loadIndex > -1 && uuidCheckIndex < loadIndex);
});

test("renders the reused HistoricalMonthlyReportView -- no separate/duplicate report renderer for the historical reader", () => {
  assert.match(
    SOURCE,
    /import \{ HistoricalMonthlyReportView \} from "@\/components\/teachers\/HistoricalMonthlyReportView";/,
  );
  assert.match(SOURCE, /<HistoricalMonthlyReportView report=\{report\} subjectColour=\{subjectColour\} \/>/);
});
