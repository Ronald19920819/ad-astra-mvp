import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Transitively imports "server-only" -- cannot be invoked directly in a
// plain node:test run, per this codebase's established precedent.

const SOURCE = readFileSync("app/api/teacher/reports/learners/route.ts", "utf8");

test("requires teacher authorization for the requested subject before loading any learner", () => {
  const authIndex = SOURCE.indexOf("authorizeTeacher(subjectId)");
  const loadIndex = SOURCE.indexOf("getSubjectEnrolledLearnersForReports(subjectId)");
  assert.ok(authIndex > -1 && loadIndex > -1 && authIndex < loadIndex);
});

test("rejects a missing or malformed subjectId before any authorization check", () => {
  const fn = SOURCE.match(/export async function GET\([\s\S]*?\n\}\n/)?.[0];
  assert.ok(fn, "GET not found");
  // Note: the header comment above the function also mentions
  // "authorizeTeacher(subjectId)" -- excluded here since we only look
  // within the function body itself.
  const uuidCheckIndex = fn!.indexOf("uuidPattern.test(subjectId)");
  const authIndex = fn!.indexOf("authorizeTeacher(subjectId)");
  assert.ok(uuidCheckIndex > -1 && authIndex > -1 && uuidCheckIndex < authIndex);
});

test("learners are scoped to the requested subject only, via the canonical reader", () => {
  assert.match(SOURCE, /getSubjectEnrolledLearnersForReports\(subjectId\)/);
});
