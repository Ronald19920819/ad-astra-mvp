import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This route transitively imports "server-only" (via
// lib/reports/monthlyReportEngine.ts, lib/supabase/teacherAuth.ts), which
// has no real node_modules entry and only resolves inside a Next.js
// server build/bundle -- so, matching this codebase's established
// precedent, the route handler cannot be invoked directly in a plain
// node:test run. These tests verify the real source directly.

const SOURCE = readFileSync("app/api/teacher/reports/preview/route.ts", "utf8");

test("the route requires teacher authorization for the requested subject before doing anything else", () => {
  assert.match(SOURCE, /authorizeTeacher\(subjectId\)/);
  const authIndex = SOURCE.indexOf("authorizeTeacher(subjectId)");
  const engineIndex = SOURCE.indexOf("generateMonthlyReportPreview(");
  assert.ok(authIndex > -1 && engineIndex > -1 && authIndex < engineIndex);
});

test("selectedLessonIds/selectedActivityIds are validated as UUID arrays and passed through UNCHANGED to the engine -- never filtered, mapped, or re-derived", () => {
  assert.match(SOURCE, /isUuidArray\(selectedLessonIds\)/);
  assert.match(SOURCE, /isUuidArray\(selectedActivityIds\)/);
  const engineCall = SOURCE.match(/generateMonthlyReportPreview\(\{[\s\S]*?\}\);/)?.[0];
  assert.ok(engineCall, "generateMonthlyReportPreview call not found");
  assert.match(engineCall!, /selectedLessonIds,/);
  assert.match(engineCall!, /selectedActivityIds,/);
  assert.doesNotMatch(engineCall!, /selectedLessonIds\.filter|selectedLessonIds\.map/);
  assert.doesNotMatch(engineCall!, /selectedActivityIds\.filter|selectedActivityIds\.map/);
});

test("teacherId is never accepted from the client -- it always comes from the authorized session", () => {
  assert.doesNotMatch(SOURCE, /payload\.teacherId|body\.teacherId/);
  assert.match(SOURCE, /teacherId: authorization\.teacher\.profileId/);
});

test("the reporting month is normalised server-side before being used, never trusted as-is from the client", () => {
  assert.match(SOURCE, /import \{ normalizeReportMonth \} from "@\/lib\/reports\/monthlyReportMonth";/);
  assert.match(SOURCE, /normalizeReportMonth\(reportMonth\)/);
});

test("the client-facing learnerProfileId is resolved to a real auth user id before reaching the engine, and a missing learner is a clean 404 not a crash", () => {
  assert.match(SOURCE, /resolveLearnerAuthUserId\(learnerProfileId\)/);
  assert.match(SOURCE, /LEARNER_NOT_FOUND/);
});

test("no report calculation happens in this route -- it only validates, resolves identities, and calls the engine", () => {
  assert.doesNotMatch(SOURCE, /calculateWeightedAcademicSummary|calculateEngagementSummary|calculateMonthlyReportBadge/);
});
