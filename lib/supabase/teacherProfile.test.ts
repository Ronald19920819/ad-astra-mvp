import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// lib/supabase/teacherProfile.ts imports "server-only" and cannot be
// invoked directly in a plain node:test run -- see
// lib/supabase/coinLedger.test.ts's header comment for the established
// precedent. These tests verify the real source directly.

const SOURCE = readFileSync("lib/supabase/teacherProfile.ts", "utf8");
// getAuthenticatedTeacherProfile is the last declaration before
// getAuthenticatedTeacherProfileDashboard -- sliced to that boundary
// rather than end-of-file since another export follows it.
const targetFn = SOURCE.slice(
  SOURCE.indexOf("export async function getAuthenticatedTeacherProfile("),
  SOURCE.indexOf("export async function getAuthenticatedTeacherProfileDashboard("),
);

// AD ASTRA -- CENTRAL SUPABASE SESSION REFRESH (proxy.ts): E -- existing
// teacher profile resolution must remain intact.

test("E: still resolves the user via createSupabaseRequestClient().auth.getUser() before loading the profile", () => {
  assert.match(targetFn, /const requestClient = await createSupabaseRequestClient\(\);/);
  assert.match(targetFn, /await requestClient\.auth\.getUser\(\);/);
});

test("E: an ordinary unauthenticated caller (no error, no user) still returns null with no logging -- not every null result is a failure", () => {
  const nullReturnIndex = targetFn.indexOf("if (error || !user) return null;");
  const logIndex = targetFn.indexOf('await logAuthDiagnostic(\n      "Teacher auth resolution failed:",\n      "teacher-page.auth"');
  assert.ok(nullReturnIndex > -1 && logIndex > -1);
  // The log is gated on `if (error)` alone, strictly before the combined
  // `error || !user` null-return -- so a bare missing user with no error
  // never reaches the logAuthDiagnostic call.
  const errorGateIndex = targetFn.indexOf("if (error) {");
  assert.ok(errorGateIndex > -1 && errorGateIndex < logIndex && logIndex < nullReturnIndex);
});

test("E: a genuine auth error is logged via the shared logAuthDiagnostic helper with stage 'teacher-page.auth', correlatable with the same request's proxy-stage log", () => {
  const logCall = targetFn.match(/await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.auth",\s*\n\s*"auth_get_user_failed",\s*\n\s*error,\s*\n\s*\);/)?.[0];
  assert.ok(logCall, "the auth_get_user_failed logAuthDiagnostic call was not found");
});

test("E: still delegates to loadTeacherProfileForUser for the actual profile/assignment lookup -- unchanged", () => {
  assert.match(targetFn, /return loadTeacherProfileForUser\(user\);/);
});

// D -- FOLLOW-UP DIAGNOSTIC IMPROVEMENT: loadTeacherProfileForUser's
// throw/null points are now individually stage-labelled and logged
// (diagnostic classification only -- every throw/return still happens
// exactly as before; nothing here changes what the caller receives).

const loadFn = SOURCE.slice(
  SOURCE.indexOf("async function loadTeacherProfileForUser("),
  SOURCE.indexOf("export async function getAuthenticatedTeacherProfile("),
);

test("D: a profiles lookup DB error and a genuinely missing profile row are distinguished by stage 'teacher-page.profile', with the pre-existing throw/null-return preserved exactly", () => {
  assert.match(
    loadFn,
    /if \(profileError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.profile",\s*\n\s*"profile_lookup_failed",\s*\n\s*profileError,\s*\n\s*\);\s*\n\s*throw profileError;/,
  );
  assert.match(
    loadFn,
    /if \(!profile\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.profile",\s*\n\s*"profile_not_found",\s*\n\s*\);\s*\n\s*return null;/,
  );
});

test("D: a teacher_profiles lookup DB error is distinguished from an inactive/missing active teacher profile, both under stage 'teacher-page.teacher-profile' -- the exact 'active' status check is unchanged", () => {
  assert.match(
    loadFn,
    /if \(teacherProfileError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.teacher-profile",\s*\n\s*"teacher_profile_lookup_failed",\s*\n\s*teacherProfileError,/,
  );
  assert.match(
    loadFn,
    /if \(!teacherProfile \|\| teacherProfile\.status !== "active"\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.teacher-profile",\s*\n\s*!teacherProfile \? "teacher_profile_not_found" : "teacher_profile_inactive",\s*\n\s*\);\s*\n\s*return null;/,
  );
});

test("D: a subject-assignment (assignedSubjects) DB error is distinguished under stage 'teacher-page.subject-assignment'", () => {
  assert.match(
    loadFn,
    /if \(assignmentError\) \{\s*\n\s*await logAuthDiagnostic\(\s*\n\s*"Teacher auth resolution failed:",\s*\n\s*"teacher-page\.subject-assignment",\s*\n\s*"subject_assignment_lookup_failed",\s*\n\s*assignmentError,/,
  );
});

test("regression: teacher_profiles.status must still be 'active' and teacher_subjects assignment status must still be 'active' for assignedSubjects", () => {
  assert.match(loadFn, /!teacherProfile \|\| teacherProfile\.status !== "active"/);
  assert.match(loadFn, /\.eq\("teacher_profile_id", teacherProfile\.id\)\s*\n\s*\.eq\("status", "active"\);/);
});

// AD ASTRA -- TEACHER DASHBOARD RELIABILITY: getTeacherTeachingOverview()
// previously chained lessonIds -> materialIds -> activityIds through
// three separate .in() queries, which could produce an oversized
// PostgREST request URL (~15,851 characters observed in production,
// UND_ERR_HEADERS_OVERFLOW). It now makes exactly one RPC call to
// supabase/migrations/202609150001_teacher_teaching_overview_rpc.sql's
// get_teacher_teaching_overview(), which computes the same five
// statistics server-side via real SQL joins/COUNT DISTINCT. Separately,
// getAuthenticatedTeacherProfileDashboard() no longer lets a
// teaching-overview failure discard an already-resolved teacher profile.

const overviewFn = SOURCE.slice(
  SOURCE.indexOf("export async function getTeacherTeachingOverview("),
  SOURCE.indexOf("async function loadTeacherProfileForUser("),
);

test("A: the chained lessonIds/materialIds/activityIds .in() architecture is gone -- no .in(\"lesson_id\"/\"lesson_material_id\"/\"activity_id\", ...) filters remain in this function", () => {
  assert.doesNotMatch(overviewFn, /\.in\("lesson_id"/);
  assert.doesNotMatch(overviewFn, /\.in\("lesson_material_id"/);
  assert.doesNotMatch(overviewFn, /\.in\("activity_id"/);
  assert.doesNotMatch(overviewFn, /\.from\("lesson_materials"\)/);
  assert.doesNotMatch(overviewFn, /\.from\("activities"\)/);
  assert.doesNotMatch(overviewFn, /\.from\("activity_submissions"\)/);
  assert.doesNotMatch(SOURCE, /countDistinctActiveLearners/);
});

test("B/G: the application performs exactly one teaching-overview RPC call, with a single scalar teacher-profile id as its only argument -- never a subject/content id array", () => {
  const rpcCalls = [...overviewFn.matchAll(/\.rpc\(/g)];
  assert.equal(rpcCalls.length, 1, "expected exactly one .rpc() call");
  assert.match(
    overviewFn,
    /\.rpc\("get_teacher_teaching_overview", \{\s*\n\s*p_teacher_profile_id: profile\.teacherProfileId,\s*\n\s*\}\)\s*\n\s*\.single\(\);/,
  );
  assert.doesNotMatch(overviewFn, /assignedSubjects\.map/);
  assert.doesNotMatch(overviewFn, /subjectIds/);
});

test("C: every returned field maps from the RPC's snake_case column to the exact TeacherTeachingOverview shape", () => {
  assert.match(overviewFn, /subjectsTaught: row\.subjects_taught,/);
  assert.match(overviewFn, /activeLearners: row\.active_learners,/);
  assert.match(overviewFn, /publishedLessons: row\.published_lessons,/);
  assert.match(overviewFn, /publishedActivities: row\.published_activities,/);
  assert.match(
    overviewFn,
    /submissionsAwaitingReview: row\.submissions_awaiting_review,/,
  );
});

test("regression: an RPC error is still thrown (not swallowed) by getTeacherTeachingOverview() itself -- isolation happens one level up, in getAuthenticatedTeacherProfileDashboard()", () => {
  assert.match(overviewFn, /if \(error\) throw error;/);
});

const dashboardFn = SOURCE.slice(
  SOURCE.indexOf("export async function getAuthenticatedTeacherProfileDashboard("),
);

test("D: the teaching-overview fallback is the exact same all-zero TeacherTeachingOverview shape used elsewhere as an initial/failure default", () => {
  assert.match(
    dashboardFn,
    /let teachingOverview: TeacherTeachingOverview = \{\s*\n\s*subjectsTaught: 0,\s*\n\s*activeLearners: 0,\s*\n\s*publishedLessons: 0,\s*\n\s*publishedActivities: 0,\s*\n\s*submissionsAwaitingReview: 0,\s*\n\s*\};/,
  );
});

test("E: a teaching-overview failure does not discard the already-resolved profile -- the try/catch wraps only getTeacherTeachingOverview(), and the returned object always includes the real profile", () => {
  assert.match(
    dashboardFn,
    /try \{\s*\n\s*teachingOverview = await getTeacherTeachingOverview\(profile\);\s*\n\s*\} catch \(error\) \{/,
  );
  assert.match(
    dashboardFn,
    /return \{\s*\n\s*profile,\s*\n\s*teachingOverview,\s*\n\s*\};/,
  );
});

test("F: an overview failure is logged via the shared logAuthDiagnostic helper under stage 'teacher-page.teaching-overview', with the raw error only (no teacher/subject id, name, or email)", () => {
  assert.match(
    dashboardFn,
    /await logAuthDiagnostic\(\s*\n\s*"Teacher dashboard teaching overview failed:",\s*\n\s*"teacher-page\.teaching-overview",\s*\n\s*"teaching_overview_failed",\s*\n\s*error,\s*\n\s*\);/,
  );
  const catchBlock = dashboardFn.slice(
    dashboardFn.indexOf("} catch (error) {"),
    dashboardFn.indexOf("}", dashboardFn.indexOf("} catch (error) {") + 20) + 1,
  );
  assert.doesNotMatch(catchBlock, /profile\.(teacherProfileId|profileId|userId|email|displayName)/);
});

test("regression: getAuthenticatedTeacherProfileDashboard() still returns null exactly when getAuthenticatedTeacherProfile() returns null -- unauthenticated behaviour is unchanged", () => {
  assert.match(
    dashboardFn,
    /const profile = await getAuthenticatedTeacherProfile\(\);\s*\n\s*if \(!profile\) return null;/,
  );
});
