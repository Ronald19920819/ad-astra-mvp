import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only", so per this codebase's
// established precedent it cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.
//
// IMPORTANT: this file lives under a Next.js dynamic-route folder
// ([reportId]). Run this file explicitly, never via the standard glob
// runner:
//   node --import tsx "app/api/teacher/reports/[reportId]/recipient-default/route.test.ts"

const SOURCE = readFileSync(
  "app/api/teacher/reports/[reportId]/recipient-default/route.ts",
  "utf8",
);

test("resolves the learner from the report's own stored learner_id -- never from any client-supplied identifier", () => {
  assert.match(SOURCE, /getLearnerProfileByAuthUserId\(existing\.learner_id\)/);
  assert.doesNotMatch(SOURCE, /request\.json\(\)|searchParams\.get\("learner/);
});

test("authorizes the teacher against the report's own subject before resolving any learner data", () => {
  const authIndex = SOURCE.indexOf("authorizeTeacher(existing.subject_id)");
  const resolveIndex = SOURCE.indexOf("getLearnerProfileByAuthUserId(");
  assert.ok(authIndex > -1 && resolveIndex > -1 && authIndex < resolveIndex);
});

test("returns null (never an error) when the learner has no resolvable email, rather than failing the request", () => {
  assert.match(SOURCE, /learnerProfile\?\.email \?\? null/);
});
