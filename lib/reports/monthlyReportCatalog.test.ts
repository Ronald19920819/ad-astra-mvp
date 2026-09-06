import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// monthlyReportCatalog.ts begins with `import "server-only"` and calls
// createSupabaseAdminClient(), so per this codebase's established
// precedent it cannot be invoked directly in a plain node:test run.
// These assertions verify the real source's scoping/exclusion rules
// directly.

const SOURCE = readFileSync("lib/reports/monthlyReportCatalog.ts", "utf8");

test("the catalog module is server-only", () => {
  assert.match(SOURCE, /^import "server-only";/);
});

test("enrolled-learner listing is scoped to approved, active enrolments in the requested subject only", () => {
  const fn = SOURCE.match(/export async function getSubjectEnrolledLearnersForReports\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "getSubjectEnrolledLearnersForReports not found");
  assert.match(fn!, /\.eq\("subject_id", subjectId\)/);
  assert.match(fn!, /\.eq\("status", "approved"\)/);
  assert.match(fn!, /\.eq\("is_active", true\)/);
  assert.match(fn!, /\.eq\("status", "active"\)/); // learner_profiles.status
  assert.match(fn!, /\.eq\("role", "learner"\)/);
});

test("LOCKED: the reportable catalog is never filtered by any learner's completion/submission state -- it has no learner parameter at all", () => {
  const fn = SOURCE.match(/export async function getSubjectReportableCatalog\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "getSubjectReportableCatalog not found");
  assert.doesNotMatch(fn!, /learner_id|learnerId/);
});

test("the reportable catalog only includes published lessons", () => {
  const fn = SOURCE.match(/export async function getSubjectReportableCatalog\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn);
  assert.match(fn!, /\.eq\("status", "published"\)/);
});

test("quizzes are excluded from the graded-activity catalog via the canonical filterActivityBackedMaterialIds, never a re-implemented check", () => {
  assert.match(SOURCE, /import \{ filterActivityBackedMaterialIds \} from "@\/lib\/activities\/activityBackedMaterial";/);
  assert.match(SOURCE, /filterActivityBackedMaterialIds\(materials/);
  assert.doesNotMatch(SOURCE, /material_type.*!==.*"quiz"|!= "quiz"/);
});

test("learnerProfileId is resolved to the real auth.users id via the same learner_profiles -> profiles join shape used elsewhere, never invented fresh", () => {
  const fn = SOURCE.match(/export async function resolveLearnerAuthUserId\([\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "resolveLearnerAuthUserId not found");
  assert.match(fn!, /\.from\("learner_profiles"\)/);
  assert.match(fn!, /\.from\("profiles"\)/);
  assert.match(fn!, /auth_user_id/);
});
