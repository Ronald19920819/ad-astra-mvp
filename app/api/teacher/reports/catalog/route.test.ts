import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" -- cannot be invoked directly in a
// plain node:test run, per this codebase's established precedent.

const SOURCE = readFileSync("app/api/teacher/reports/catalog/route.ts", "utf8");

test("requires teacher authorization for the requested subject before loading the catalog", () => {
  const authIndex = SOURCE.indexOf("authorizeTeacher(subjectId)");
  const loadIndex = SOURCE.indexOf("getSubjectReportableCatalog(subjectId)");
  assert.ok(authIndex > -1 && loadIndex > -1 && authIndex < loadIndex);
});

test("returns the catalog exactly as the canonical reader produces it -- no learner-specific filtering happens in this route", () => {
  assert.match(SOURCE, /getSubjectReportableCatalog\(subjectId\)/);
  assert.doesNotMatch(SOURCE, /learnerId|learnerProfileId/);
});
